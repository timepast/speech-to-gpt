import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import classNames from "classnames";
import { VoiceIcon, SendIcon } from "../Icons";
import "./index.css";

const SpeechToText = () => {
  const [text, setText] = useState(""); // 语音识别结果
  const [isRecording, setIsRecording] = useState(false); // 是否正在录音
  const [loading, setLoading] = useState(false); // 是否正在加载
  const [answer, setAnswer] = useState([]); // GPT 响应
  const [voiceStatus, setVoiceStatus] = useState(false);
  const recognitionRef = useRef(null); // 语音识别实例引用
  const resultIndexRef = useRef(0); // 用于记录处理到的结果索引
  const editorRef = useRef(null);

  useEffect(() => {
    const textarea = editorRef.current;
    if (textarea) {
      textarea.style.height = "auto"; // 先重置高度，防止高度不减少
      textarea.style.height = `${textarea.scrollHeight}px`; // 让高度等于内容高度
    }
  }, [text]);

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("❌ 你的浏览器不支持语音识别！");
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.continuous = true; // 持续识别
      recognitionRef.current.interimResults = true; // 支持中间结果
      recognitionRef.current.lang = "zh-CN,en-US"; // 中文+英文识别

      recognitionRef.current.onstart = () => {
        setIsRecording(true);
        resultIndexRef.current = 0; // 重置结果索引
        // console.log("----- onstart", resultIndexRef.current);
      };

      let newText = "";
      let prevText = "";
      recognitionRef.current.onresult = (event) => {
        // 一段对话的最开始
        if (newText === "") {
          setText((prev) => {
            if (prev !== "") {
              prevText = prev.slice(0, prev.length - 2) + ", ";
            }
            return prev;
          });
        }

        for (let i = resultIndexRef.current; i < event.results.length; i++) {
          const transcriptSegment = event.results[i][0].transcript;
          // console.log("----- event.results[i], ", event.results[i]);
          newText = transcriptSegment;
          setText(prevText + newText);

          if (event.results[i].isFinal) {
            setText((prev) => prev + ". "); // 追加新的文本
            resultIndexRef.current++; // 更新已处理的结果索引
            newText = "";
          }
        }
      };

      recognitionRef.current.onerror = (event) =>
        console.error("❌ 语音识别错误:", event);

      recognitionRef.current.onend = () => setIsRecording(false);
    }

    recognitionRef.current.start(); // 开始识别
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop(); // 停止识别
      setIsRecording(false);
    }
  };

  const sendToGPT = async () => {
    if (!text.trim()) return;

    setLoading(true);
    setAnswer((prev) => {
      return [...prev, { type: "question", content: text }];
    });
    // return;

    try {
      const response = await fetch("http://localhost:5001/api/gpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      setText("");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk.replace(/\<(\/)?think\>/g, ""); // 移除 <think> 标签

        setAnswer((prev) => {
          let last = prev[prev.length - 1];
          if (last.type !== "question") {
            prev.pop();
          }
          let res = [...prev, { type: "answer", content: fullText }];
          return res;
        });
      }
    } catch (error) {
      console.error("Error calling GPT API:", error);
    } finally {
      setLoading(false);
    }
  };

  const onVoiceHandle = useCallback(() => {
    if (!voiceStatus) {
      startListening();
      setVoiceStatus(true);
    } else {
      stopListening();
      setVoiceStatus(false);
    }
  }, [voiceStatus]);

  const EditorWrapHandle = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  });

  let voiceClassName = classNames(
    "semi-icon semi-icon-default icon-mic-voice",
    {
      recording: isRecording,
    }
  );
  return (
    <div className="container">
      {answer.length === 0 && <h2 className="main-title">你好!</h2>}

      <div className="answer-container">
        {answer.map((item, i) => {
          let itemComp = null;
          if (item.type === "question") {
            itemComp = (
              <div className="question-section">
                <div className="content">
                  <p>{item.content}</p>
                </div>
              </div>
            );
          } else {
            itemComp = (
              <ReactMarkdown className="markdown" remarkPlugins={[remarkGfm]}>
                {item.content}
              </ReactMarkdown>
            );
          }
          return (
            <div className="answer-section" key={i}>
              {itemComp}
            </div>
          );
        })}
      </div>
      <div className="editor-container" onClick={EditorWrapHandle}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          ref={editorRef}
          dir="ltr"
          rows="1"
          autoComplete="off"
          cols="20"
          className="semi-input-textarea semi-input-textarea-autosize"
          placeholder="发消息、输入 @ 或 / 选择技能"
          style={{
            height: "24px",
          }}
        ></textarea>
        <div className="bottom-tools-wrap">
          <div className="right-tools-wrap">
            <span
              role="img"
              className={voiceClassName}
              onClick={onVoiceHandle}
              data-tooltip={isRecording ? "停止语音输入" : "语音输入"}
            >
              <VoiceIcon />
            </span>

            <button
              onClick={sendToGPT}
              disabled={!text.trim() || loading}
              id="flow-end-msg-send"
              aria-disabled="false"
              aria-label="发送"
              data-testid="chat_input_send_button"
              aria-describedby="xrvs1sh"
              data-popupid="xrvs1sh"
              className="semi-button semi-button-primary send-btn semi-button-with-icon semi-button-with-icon-only"
              type="button"
            >
              <span className="semi-button-content">
                <span
                  role="img"
                  className="semi-icon semi-icon-default"
                  data-tooltip="发送"
                >
                  <SendIcon />
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechToText;

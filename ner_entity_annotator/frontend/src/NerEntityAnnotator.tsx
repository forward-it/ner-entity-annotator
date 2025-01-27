import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react"
import { Streamlit, withStreamlitConnection, ComponentProps } from "streamlit-component-lib"
import { RiEditFill } from "react-icons/ri"

// Basic incoming shape: start_token/end_token are char offsets in the text
export interface Span {
    start_token: number
    end_token: number
    label: string
}

interface EditableSpan extends Span {
    span_id: number
    editing: boolean
    tempLabel?: string
}

let globalSpanCounter = 1

function NerEntityAnnotator({ args }: ComponentProps) {
    // ---------- Props ----------
    const text: string = args["text"] ?? ""
    const rawSpans: Span[] = args["spans"] ?? []
    const allowedLabels: string[] = args["labels"] ?? []
    const userColors: Record<string, string> = args["colors"] ?? {}

    // ---------- Options ----------
    const options = args["options"] ?? {}
    // If true, we do not show the left/right arrow boundary controls
    const disableArrows = !!options["disable_span_position_edit"]

    // ---------- Colors ----------
    // Merge user colors with some defaults.
    const defaultColors: Record<string, string> = {
        ORG: "#7aecec",
        PRODUCT: "#bfeeb7",
        GPE: "#feca74",
        LOC: "#ff9561",
        PERSON: "#aa9cfc",
        NORP: "#c887fb",
        FAC: "#9cc9cc",
        EVENT: "#ffeb80",
        LAW: "#ff8197",
        LANGUAGE: "#ff8197",
        WORK_OF_ART: "#f0d0ff",
        DATE: "#bfe1d9",
        TIME: "#bfe1d9",
        MONEY: "#e4e7d2",
        QUANTITY: "#e4e7d2",
        ORDINAL: "#e4e7d2",
        CARDINAL: "#e4e7d2",
        PERCENT: "#e4e7d2",
    }
    const colors = { ...defaultColors, ...userColors }
    const defaultColor = "#ddd"

    // ---------- Convert incoming spans ----------
    const toEditableSpans = useCallback(
        (spans: Span[]): EditableSpan[] =>
            spans
                .filter(s => allowedLabels.includes(s.label))
                .map(s => ({
                    ...s,
                    span_id: globalSpanCounter++,
                    editing: false,
                    tempLabel: s.label,
                })),
        [allowedLabels]
    )

    const [componentSpans, setComponentSpans] = useState<EditableSpan[]>(() =>
        toEditableSpans(rawSpans)
    )

    // ---------- Sync changes back to Streamlit ----------
    useEffect(() => {
        const plainSpans = componentSpans.map(({ span_id, editing, tempLabel, ...rest }) => rest)
        Streamlit.setComponentValue(plainSpans)
    }, [componentSpans])

    // ---------- Word-based boundary adjustments ----------
    function isWhitespace(ch: string): boolean {
        return /\s/.test(ch)
    }

    /** Move the start boundary left by one word. */
    function moveStartLeft(s: EditableSpan): number {
        if (s.start_token <= 0) return s.start_token
        let i = s.start_token - 1
        while (i > 0 && isWhitespace(text[i])) i--
        while (i > 0 && !isWhitespace(text[i - 1])) i--
        return Math.max(0, i)
    }

    /** Move the start boundary right by one word. */
    function moveStartRight(s: EditableSpan): number {
        if (s.start_token >= text.length - 1) return s.start_token
        let i = s.start_token
        const len = text.length
        // skip current "word"
        while (i < len && !isWhitespace(text[i])) i++
        // skip whitespace
        while (i < len && isWhitespace(text[i])) i++
        if (i >= s.end_token) {
            i = s.end_token - 1
            if (i < 0) i = 0
        }
        return i
    }

    /** Move the end boundary left by one word. */
    function moveEndLeft(s: EditableSpan): number {
        if (s.end_token <= s.start_token + 1) return s.end_token
        let i = s.end_token - 1
        while (i > s.start_token && isWhitespace(text[i])) i--
        while (i > s.start_token && !isWhitespace(text[i - 1])) i--
        if (i <= s.start_token) i = s.start_token + 1
        return i
    }

    /** Move the end boundary right by one word. */
    function moveEndRight(s: EditableSpan): number {
        if (s.end_token >= text.length) return s.end_token
        let i = s.end_token
        const len = text.length
        // skip whitespace
        while (i < len && isWhitespace(text[i])) i++
        // skip next word
        while (i < len && !isWhitespace(text[i])) i++
        if (i <= s.start_token) i = s.start_token + 1
        if (i > len) i = len
        return i
    }

    const adjustStart = (span_id: number, dir: "left" | "right") => {
        setComponentSpans(prev =>
            prev.map(s => {
                if (s.span_id !== span_id) return s
                let newStart = s.start_token
                if (dir === "left") {
                    newStart = moveStartLeft(s)
                } else {
                    newStart = moveStartRight(s)
                }
                // clamp so we never invert start >= end
                if (newStart >= s.end_token) {
                    newStart = s.end_token - 1
                    if (newStart < 0) newStart = 0
                }
                return { ...s, start_token: newStart }
            })
        )
    }

    const adjustEnd = (span_id: number, dir: "left" | "right") => {
        setComponentSpans(prev =>
            prev.map(s => {
                if (s.span_id !== span_id) return s
                let newEnd = s.end_token
                if (dir === "left") {
                    newEnd = moveEndLeft(s)
                } else {
                    newEnd = moveEndRight(s)
                }
                if (newEnd <= s.start_token) {
                    newEnd = s.start_token + 1
                }
                return { ...s, end_token: newEnd }
            })
        )
    }

    // ---------- Edit / remove ----------
    const handleEditToggle = (span_id: number) => {
        setComponentSpans(prev =>
            prev.map(s => {
                if (s.span_id === span_id) {
                    return {
                        ...s,
                        editing: !s.editing,
                        tempLabel: s.editing ? s.label : s.tempLabel,
                    }
                }
                return s
            })
        )
    }

    const handleApproveEdit = (span_id: number) => {
        setComponentSpans(prev =>
            prev.map(s => {
                if (s.span_id === span_id) {
                    return { ...s, label: s.tempLabel ?? s.label, editing: false }
                }
                return s
            })
        )
    }

    const handleRemoveSpan = (span_id: number) => {
        setComponentSpans(prev => prev.filter(s => s.span_id !== span_id))
    }

    const handleLabelChange = (span_id: number, newLabel: string) => {
        setComponentSpans(prev =>
            prev.map(s => (s.span_id === span_id ? { ...s, tempLabel: newLabel } : s))
        )
    }

    // ---------- Create new span on text selection ----------
    const handleMouseUp = useCallback(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) return
        const range = sel.getRangeAt(0)
        if (!range) return

        const startParent = range.startContainer.parentElement
        const endParent = range.endContainer.parentElement
        if (!startParent || !endParent) return

        const startIdx = parseInt(startParent.getAttribute("data-ch-idx") ?? "-1", 10)
        const endIdx = parseInt(endParent.getAttribute("data-ch-idx") ?? "-1", 10)
        if (startIdx < 0 || endIdx < 0) return

        const spanStart = Math.min(startIdx, endIdx)
        const spanEnd = Math.max(startIdx, endIdx) + 1
        if (spanEnd <= spanStart || spanEnd > text.length) return

        const defaultLbl = allowedLabels.length ? allowedLabels[0] : "MISC"
        const newSpan: EditableSpan = {
            span_id: globalSpanCounter++,
            start_token: spanStart,
            end_token: spanEnd,
            label: defaultLbl,
            editing: true,
            tempLabel: defaultLbl,
        }
        setComponentSpans(prev => [...prev, newSpan])
        sel.removeAllRanges()
    }, [allowedLabels, text])

    // ---------- Building the final display ----------
    const sortedSpans = useMemo(() => {
        return [...componentSpans].sort((a, b) => a.start_token - b.start_token)
    }, [componentSpans])

    function buildDisplayContent(): React.ReactNode[] {
        const result: React.ReactNode[] = []
        let offset = 0
        for (const ent of sortedSpans) {
            if (offset < ent.start_token) {
                result.push(renderPlainTextSegment(offset, ent.start_token))
            }
            result.push(renderEntitySegment(ent))
            offset = ent.end_token
        }
        if (offset < text.length) {
            result.push(renderPlainTextSegment(offset, text.length))
        }
        return result
    }

    function renderPlainTextSegment(start: number, end: number): React.ReactNode {
        const nodes: React.ReactNode[] = []
        for (let i = start; i < end; i++) {
            nodes.push(
                <span key={i} data-ch-idx={i}>
                    {text[i]}
                </span>
            )
        }
        return <React.Fragment key={`${start}-${end}`}>{nodes}</React.Fragment>
    }

    function renderEntitySegment(spanObj: EditableSpan): React.ReactNode {
        const { span_id, editing, label, tempLabel } = spanObj
        const color = colors[label.toUpperCase()] || defaultColor
        const substring = text.slice(spanObj.start_token, spanObj.end_token)

        return (
            <mark
                key={span_id}
                className={`entity${editing ? " editing" : ""}`}
                style={{
                    background: color,
                    padding: "0.45em 0.6em",
                    margin: "0 0.25em",
                    lineHeight: 1,
                    borderRadius: "0.35em",
                    position: "relative",
                    display: "inline-block", // so scaling doesn't shift layout
                }}
            >
                {/* Conditionally render left boundary arrows if not disabled */}
                {!disableArrows && (
                    <div className="extend-controls left-extend">
                        <button className="extend-btn" onClick={() => adjustStart(span_id, "left")}>
                            ←
                        </button>
                        <button className="extend-btn" onClick={() => adjustStart(span_id, "right")}>
                            →
                        </button>
                    </div>
                )}

                {/* The text + label area */}
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                    <span style={{ userSelect: "none", marginRight: "0.1em" }}>{substring}</span>
                    <span className="span-label" style={{ background: color }}>
                        {editing ? (
                            <select
                                style={{ marginLeft: 6 }}
                                value={tempLabel}
                                onChange={e => handleLabelChange(span_id, e.target.value)}
                            >
                                {allowedLabels.map(lbl => (
                                    <option key={lbl} value={lbl}>
                                        {lbl}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            label
                        )}

                        {/* Edit/Remove/Approve buttons */}
                        <span className="span-buttons">
                            {editing ? (
                                <button className="approve-btn" onClick={() => handleApproveEdit(span_id)}>
                                    ✓
                                </button>
                            ) : (
                                <>
                                    <button className="edit-btn" onClick={() => handleEditToggle(span_id)}>
                                        <RiEditFill />
                                    </button>
                                    <button className="remove-btn" onClick={() => handleRemoveSpan(span_id)}>
                                        ✕
                                    </button>
                                </>
                            )}
                        </span>
                    </span>
                </span>

                {/* Conditionally render right boundary arrows if not disabled */}
                {!disableArrows && (
                    <div className="extend-controls right-extend">
                        <button className="extend-btn" onClick={() => adjustEnd(span_id, "left")}>
                            ←
                        </button>
                        <button className="extend-btn" onClick={() => adjustEnd(span_id, "right")}>
                            →
                        </button>
                    </div>
                )}
            </mark>
        )
    }

    // Resize on each render
    useEffect(() => {
        Streamlit.setFrameHeight()
    })

    // ---------- Styles ----------
    const styleTag = (
        <style>{`
      .entity {
        transition: transform 0.15s;
        user-select: none;
      }
      /* Hover entire entity => scale up */
      .entity:hover {
        padding: 0.45em 0;
        transform: scale(1.2);
        z-index: 10;
      }

      /* Show boundary arrows only if .editing and not disableArrows (conditional rendering) */
      .extend-controls {
        display: none;
      }
      .entity.editing .extend-controls {
        padding: 0;
        display: inline-flex;
        flex-direction: column;
        margin: 0 4px;
        vertical-align: middle;
      }

      .extend-btn {
        background: #666;
        color: #fff;
        border: none;
        border-radius: 3px;
        font-size: 0.5em;
        cursor: pointer;
        margin: 1px 0;
        width: 2em;
      }
      .extend-btn:hover {
        background: #333;
      }

      .span-label {
        position: relative;
        display: inline-flex;
        font-size: 0.6em;
        transition: transform 0.15s;
        padding: 0 3px;
        margin-top: 4px;
        border-radius: 3px;
        align-items: center;
      }

      .span-buttons {
        display: inline-flex;
        align-items: center;
        margin-left: 6px;
        gap: 4px;
      }
      /* Hide edit/remove if not hovering and not editing */
      .entity:not(:hover) .span-buttons {
        display: none;
      }
      .entity.editing .span-buttons {
        display: inline-flex;
      }

      .edit-btn,
      .remove-btn {
        background: #333333;
        color: white;
        border: none;
        border-radius: 3px;
        font-size: 1em;
        cursor: pointer;
      }
      .edit-btn:hover,
      .remove-btn:hover {
        background: #555;
      }
      .remove-btn {
        background: #EE0000;
      }
      .approve-btn {
        background: #008000;
        color: white;
        border: none;
        border-radius: 3px;
        font-size: 1em;
        width: 30px;
        cursor: pointer;
      }
      .approve-btn:hover {
        background: #008000;
      }

      /* Hide remove button in editing mode, if you like. (From your old snippet) */
      .entity.editing .remove-btn {
        display: none;
      }

      /* For the plain-text portion, each character gets data-ch-idx so we can detect selection. */
      [data-ch-idx] {
        user-select: text;
      }

      .left-extend {
        margin-right: 4px;
      }
      .right-extend {
        margin-left: 4px;
      }
    `}</style>
    )

    return (
        <div
            className="entities"
            style={{ lineHeight: 2.5, direction: "ltr" }}
            onMouseUp={handleMouseUp}
        >
            {styleTag}
            {buildDisplayContent()}
        </div>
    )
}

export default withStreamlitConnection(NerEntityAnnotator)

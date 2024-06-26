import { createRef, PureComponent } from 'react';
import { Data, PlainTextData, HtmlData } from '../../document';
import './data-preview.css';

export function DataPreview({ data }: { data: Data }) {
    if (data instanceof HtmlData) {
        return <HtmlPreview html={data.contents} />;
    } else if (data instanceof PlainTextData) {
        return <TextPreview text={data.contents} />;
    }
    return <UnknownPreview type={data.typeDescription()} />;
}

class HtmlPreview extends PureComponent<{ html: string }> {
    node = createRef<HTMLDivElement>();

    componentDidMount() {
        this.renderHtml();
    }

    componentDidUpdate(prevProps: { html: string }) {
        if (this.props.html !== prevProps.html) {
            this.renderHtml();
        }
    }

    renderHtml() {
        if (!this.node.current!.shadowRoot) {
            this.node.current!.attachShadow({ mode: 'open' });
        }
        const doc = new DOMParser().parseFromString(this.props.html, 'text/html');
        for (const node of doc.querySelectorAll('script, iframe')) {
            node.remove();
        }
        this.node.current!.shadowRoot!.innerHTML = doc.body.innerHTML;
    }

    render() {
        return <div className="data-preview-html" ref={this.node} />;
    }
}

function TextPreview({ text }: { text: string }) {
    return <div className="data-preview-text">{text}</div>;
}

function UnknownPreview({ type }: { type: string }) {
    return <div className="data-preview-unknown">no preview for {type}</div>;
}

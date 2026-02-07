import React from 'react';

type PromptCardProps = {
    lang?: 'id' | 'en';
};

const PROMPT_TEXTS = {
    id: {
        headlinePrefix: 'Telusuri kesulitan di dalam ',
        headlineSuffix: 'mu di sini',
        placeholder: `Tempel atau unggah dokumenmu untuk mulai melakukan analisis dua dimensi di sini`,
    },
    en: {
        headlinePrefix: 'Explore difficulties in your ',
        headlineSuffix: ' here',
        placeholder: `Transform your knowledge into a two-dimensional interface
(Upload your paper or paste your paper text here)`,
    },
};

export const PromptCard: React.FC<PromptCardProps> = ({ lang = 'id' }) => {
    const [dynamicWord] = React.useState('paper');

    const texts = PROMPT_TEXTS[lang];

    return (
        <div style={CARD_STYLE}>
            <div style={CARD_INNER_STYLE}>
                <div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>
                    <div style={PLACEHOLDER_LABEL_STYLE}>Sample graph preview</div>
                </div>

                <div style={HEADLINE_STYLE}>
                    {texts.headlinePrefix}
                    <span
                        id="prompt-dynamic-word"
                        className="prompt-typable-word"
                        style={DYNAMIC_WORD_STYLE}
                    >
                        {dynamicWord}
                    </span>
                    {texts.headlineSuffix}
                </div>

                <div style={INPUT_PILL_STYLE}>
                    <textarea
                        placeholder={texts.placeholder}
                        style={INPUT_STYLE}
                        rows={3}
                        readOnly
                    />
                </div>
            </div>
        </div>
    );
};

const CARD_STYLE: React.CSSProperties = {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0f1115',
    color: '#e7e7e7',
};

const CARD_INNER_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
    maxWidth: '720px',
    width: '100%',
    padding: '0 24px',
    boxSizing: 'border-box',
};

const HEADLINE_STYLE: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.4,
    textAlign: 'center',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
};

const DYNAMIC_WORD_STYLE: React.CSSProperties = {
    color: '#63abff',
    position: 'relative',
};

const GRAPH_PREVIEW_PLACEHOLDER_STYLE: React.CSSProperties = {
    width: '100%',
    height: '240px',
    borderRadius: '12px',
    border: '1px dashed #2b2f3a',
    background: 'rgba(20, 25, 35, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const PLACEHOLDER_LABEL_STYLE: React.CSSProperties = {
    fontSize: '13px',
    color: '#5a6070',
    fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};

const INPUT_PILL_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '600px',
};

const INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    padding: '16px 20px',
    borderRadius: '16px',
    border: '1px solid #2b2f3a',
    background: '#141923',
    color: '#e7e7e7',
    fontSize: '15px',
    fontFamily: 'var(--font-ui)',
    resize: 'none',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
};

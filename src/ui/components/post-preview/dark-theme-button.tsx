import './dark-theme-button.css';
import { useAnimation, useSpring } from '../../../uikit/animation';
import { useRef } from 'react';

function makeIcon({
    r0,
    r1,
    r2,
    angle,
    centerX,
    centerY,
}: {
    r0: number;
    r1: number;
    r2: number;
    angle: number;
    centerX: number;
    centerY: number;
}) {
    const cx = (d: number) => centerX + Math.cos(angle) * d;
    const cy = (d: number) => centerY + Math.sin(angle) * d;

    const d = [
        // outer circle
        `M ${cx(-r0)} ${cy(-r0)}`,
        `A ${r0} ${r0} 0 1 0 ${cx(r0)} ${cy(r0)}`,
        `A ${r0} ${r0} 0 1 0 ${cx(-r0)} ${cy(-r0)}`,

        // inner circle
        `M ${cx(-r2)} ${cy(-r2)}`,
        `A ${r2} ${r2} 0 1 0 ${cx(r2)} ${cy(r2)}`,
        `A ${r2} ${r2} 0 1 0 ${cx(-r2)} ${cy(-r2)}`,

        // invert
        `M ${cx(-r1)} ${cy(-r1)}`,
        `A ${r1} ${r1} 0 1 0 ${cx(r1)} ${cy(r1)}`,
    ].join(' ');

    return `path(evenodd, "${d}")`;
}

export function DarkThemeButton({ isDark, onClick }: { isDark: boolean; onClick: () => void }) {
    const iconRef = useRef<HTMLDivElement>(null);
    const dark = useSpring({ value: isDark ? 1 : 0, period: 0.9 });
    dark.setTarget(isDark ? 1 : 0);

    const anim = useAnimation(
        iconRef,
        { dark },
        ({ dark }) => {
            const r0 = 8 - dark * 4.3;
            const r1 = 7;
            const r2 = 3.7 + dark * 4.3;
            const angle = Math.PI / 2 + dark * Math.PI;

            return {
                clipPath: makeIcon({
                    r0,
                    r1,
                    r2,
                    angle,
                    centerX: 10,
                    centerY: 10,
                }),
            };
        },
        {
            keyframeTimeStep: 1 / 240,
        }
    );

    const styles = anim.getCurrentStyles();

    const label = isDark ? 'switch to light theme' : 'switch to dark theme';

    return (
        <button
            className={'dark-theme-button' + (isDark ? ' is-dark' : '')}
            onClick={onClick}
            title={label}
            aria-label={label}
        >
            <div ref={iconRef} className="i-icon" style={styles} />
            <div className="i-label" aria-hidden={true}>
                <div className="i-light">light theme</div>
                <div className="i-dark">dark theme</div>
            </div>
        </button>
    );
}

import { parse as cssParse, walk as cssWalk, generate as cssGenerate, CssNode } from 'css-tree';
import Specificity from '@bramus/specificity';
import { ModulePlugin, ModulePluginProps, HtmlData, CssData, Data } from '../../document';
import { Form, FormItem } from '../../uikit/form';
import Checkbox from '../../uikit/checkbox';
import { useMemo } from 'react';

type StyleInlinerMode = 'attr' | 'element';
export type StyleInlinerData = {
    mode: StyleInlinerMode;
    keepClasses?: boolean;
};

function StyleInliner({ data, onChange }: ModulePluginProps<StyleInlinerData>) {
    const id1 = useMemo(() => Math.random().toString(36), []);
    const id2 = useMemo(() => Math.random().toString(36), []);

    return (
        <Form>
            <FormItem label="mode" itemId={id1}>
                <select
                    id={id1}
                    value={data.mode}
                    onChange={(e) => {
                        onChange({
                            ...data,
                            mode: e.target.value as StyleInlinerMode,
                        });
                    }}
                >
                    <option value="attr">as style attributes</option>
                    <option value="element">as a &lt;style&gt; element</option>
                </select>
            </FormItem>
            <FormItem
                label="strip classes"
                description="Removes the `class` property from all HTML elements, because it’ll be removed by cohost anyway."
                itemId={id2}
            >
                <Checkbox
                    id={id2}
                    checked={!data.keepClasses}
                    onChange={(strip) => {
                        const newData = { ...data };
                        if (strip) delete newData.keepClasses;
                        else newData.keepClasses = true;
                        onChange(newData);
                    }}
                />
            </FormItem>
        </Form>
    );
}

type StyleData = {
    // type Specificity (for some reason typescript complains when you use this type)
    specificity: any;
    decls: Map<string, string>;
    importantDecls: Map<string, string>;
};

function stylesToAttrs(doc: Document) {
    const styles = [];
    for (const style of doc.querySelectorAll('style')) {
        styles.push(style);
        style.remove();
    }

    // collect all element styles
    const nodes: Map<Element, StyleData[]> = new Map();
    for (const style of styles) {
        let ast;
        try {
            ast = cssParse(style.innerHTML);
        } catch (err) {
            throw new Error('Error parsing CSS: ' + ((err as any)?.message || err));
        }

        cssWalk(ast, {
            enter(node: CssNode) {
                // we dont know what could happen inside @-rules.
                // they definitely don't work inline, though
                if (node.type === 'Atrule') return (this as any).skip;
            },
            leave(node: CssNode) {
                if (node.type === 'Rule') {
                    if (node.prelude.type === 'SelectorList') {
                        // collect style declarations
                        const decls = new Map<string, string>();
                        const importantDecls = new Map<string, string>();
                        node.block.children.forEach((decl) => {
                            if (decl.type === 'Declaration') {
                                const value = cssGenerate(decl.value);
                                if (decl.important) {
                                    importantDecls.delete(decl.property);
                                    importantDecls.set(decl.property, value);
                                } else {
                                    decls.delete(decl.property);
                                    decls.set(decl.property, value);
                                }
                            } else {
                                throw new Error(`invalid CSS declaration “${cssGenerate(decl)}”`);
                            }
                        });

                        // apply declarations to selector targets
                        node.prelude.children.forEach((sel) => {
                            if (sel.type === 'Selector') {
                                const selText = cssGenerate(sel);
                                const specificity = Specificity.calculate(sel)[0];
                                try {
                                    for (const node of doc.querySelectorAll(selText)) {
                                        if (!nodes.has(node)) {
                                            nodes.set(node, []);
                                        }
                                        nodes.get(node)!.push({
                                            specificity,
                                            decls,
                                            importantDecls,
                                        });
                                    }
                                } catch {
                                    /* invalid selector probably */
                                }
                            } else {
                                throw new Error(`invalid CSS selector “${cssGenerate(sel)}”`);
                            }
                        });
                    }
                }
            },
        });
    }

    // apply styles sorted by specificity
    for (const [node, styles] of nodes) {
        const sorted = styles
            .slice()
            .sort((a, b) => Specificity.compare(a.specificity, b.specificity));

        addStyleProperties(node, sorted);
    }

    // version mark. data-_ps="2" is 12 bytes, so it should be negligible
    for (const node of nodes.keys()) {
        if (!(node instanceof HTMLElement || node instanceof SVGElement)) continue;
        if (node.dataset._ps) break;
        node.dataset._ps = '2';
        break;
    }
}

function addStyleProperties(node: Element, properties: StyleData[], useLegacyMethod = false) {
    if (useLegacyMethod) {
        for (const item of properties) {
            for (const [k, v] of item.decls.entries()) {
                (node as HTMLElement).style.setProperty(k, v);
            }
        }
        for (const item of properties) {
            for (const [k, v] of item.importantDecls.entries()) {
                (node as HTMLElement).style.setProperty(k, v);
            }
        }
        return;
    }

    let ast;
    try {
        const styleAttr = node.getAttribute('style') || '';
        ast = cssParse(styleAttr, {
            context: 'declarationList',
        });
    } catch (err) {
        throw new Error(`error parsing style attribute in ${node.tagName.toLowerCase()}: ${err}`);
    }

    // collect existing rules
    const decls = new Map<string, string>();
    const importantDecls = new Map<string, string>();
    cssWalk(ast, {
        leave(node: CssNode) {
            if (node.type === 'Declaration') {
                if (node.important) {
                    importantDecls.delete(node.property); // delete first to reorder
                    importantDecls.set(node.property, cssGenerate(node.value));
                } else {
                    decls.delete(node.property);
                    decls.set(node.property, cssGenerate(node.value));
                }
            }
        },
    });

    // set of properties that were specified in the style attribute. these should be preserved in most cases
    const styleAttrDecls = new Set(Object.keys(decls));
    const importantStyleAttrDecls = new Set(Object.keys(decls));

    for (const item of properties) {
        for (const [k, v] of item.decls.entries()) {
            if (styleAttrDecls.has(k) || importantStyleAttrDecls.has(k)) continue; // style property wins
            decls.delete(k); // delete first to reorder
            decls.set(k, v);
        }
        for (const [k, v] of item.importantDecls.entries()) {
            if (importantStyleAttrDecls.has(k)) continue; // style property wins
            importantDecls.delete(k); // delete first to reorder
            importantDecls.set(k, v);
        }
    }

    for (const k of importantDecls.keys()) {
        if (decls.has(k)) {
            // overridden by !important declaration anyway
            decls.delete(k);
        }
    }

    let styleStr = '';
    for (const [k, v] of decls.entries()) {
        if (styleStr) styleStr += ';';
        styleStr += `${k}:${v}`;
    }
    for (const [k, v] of importantDecls.entries()) {
        // we do not add back “!important” here because cohost strips all properties marked !important
        if (styleStr) styleStr += ';';
        styleStr += `${k}:${v}`;
    }

    node.setAttribute('style', styleStr);
}

function stylesToBody(doc: Document) {
    const styles = [];
    for (const style of doc.querySelectorAll('style')) {
        styles.push(style);
        style.remove();
    }

    const styleText = styles.map((style) => style.innerHTML).join('\n');
    const styleEl = document.createElement('style');
    styleEl.innerHTML = styleText;

    if (doc.body.children.length === 1 && doc.body.children[0].tagName === 'svg') {
        doc.body.children[0].append(styleEl);
    } else {
        doc.body.append(styleEl);
    }
}

export default {
    id: 'transform.style-inliner',
    acceptsInputs: true,
    acceptsNamedInputs: false,
    component: StyleInliner as unknown,
    initialData() {
        return { mode: 'attr' };
    },
    description() {
        return 'Style Inliner';
    },
    async eval(data: StyleInlinerData, inputs: Data[]) {
        let htmlInput = '';
        let cssInput = '';
        for (const input of inputs) {
            let data;
            if ((data = input.into(HtmlData))) {
                htmlInput += data.contents;
            } else if ((data = input.into(CssData))) {
                cssInput += data.contents;
            } else {
                throw new Error('style inliner received input that is neither html nor css');
            }
        }

        const htmlSource = [
            '<!doctype html><html><head><style>',
            cssInput,
            '</style></head><body>',
            htmlInput,
            '</body></html>',
        ].join('');
        const doc = new DOMParser().parseFromString(htmlSource, 'text/html');

        if (data.mode === 'attr') {
            stylesToAttrs(doc);

            // cleanup for cohost
            if (!data.keepClasses) {
                for (const node of doc.querySelectorAll('[class]')) {
                    node.removeAttribute('class');
                }
            }
        } else if (data.mode === 'element') {
            stylesToBody(doc);
        }
        return new HtmlData(doc.body.innerHTML);
    },
} as ModulePlugin<StyleInlinerData>;

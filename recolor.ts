/// <reference path="./color.ts" />
/// <reference path="./get-style.ts" />

namespace ReColor {

  declare interface config {
    URL_INCLUDE_REGEX : RegExp;
    URL_EXCLUDE_REGEX : RegExp;
    MY_COLORS : string[];
    MY_SWAP_RULES : Object;
    URL_SWAP_INCLUDE_REGEX : RegExp;
    URL_SWAP_EXCLUDE_REGEX : RegExp;
    TRANSFORM_FUNCTION : Function;
  }

  export declare let CONFIG : config;

  const COLOR = '(#([0-9A-F]{3,4}){1,2}\\b)|(\\brgba?\\(.+?\\))|(\bhsla?\\(.+?\\))';
  const COLOR_REGEX = new RegExp(`${COLOR}|(\\b(${Color.getColorNames().join("|")}|transparent)\\b)`, "i");

  export function isolateFunction(f : Function) {
    let safeF = new Function('obj',
                             'window',
                             'document',
                             '"use strict";'
                             + `return (function() { return (${f.toString()}).apply({}, arguments); });`);
    return safeF.bind({}, {}, {}, {})();
  }

  function parseCSS(css : string) {
    let doc = document.implementation.createHTMLDocument('');
    let style = document.createElement('style');
    style.textContent = css;
    doc.body.appendChild(style);
    return (<any>style.sheet).cssRules;
  }

  function getColorRules(rs) {
    return toArray(rs).map(getColorCSS)
                      .filter(r => r.length > 0);
  }

  function getColorCSS(rule) : string {
    const COLOR_PROPERTY_REGEX = /^(background(-color)?|color)$/;
    const NOT_PROPERTY_REGEX = /\burl\(/;
    let colorRules: String[] = [];

    switch (rule.type) {
      case CSSRule.MEDIA_RULE:
      case 4:
        colorRules = getColorRules(rule.cssRules);
        return (colorRules.length) ? `@media ${rule.media.mediaText} { ${colorRules.join("\n")} }` : "";
      break;

      case CSSRule.KEYFRAMES_RULE:
      case 7:
      case CSSRule.SUPPORTS_RULE:
      case 12:
        colorRules = getColorRules(rule.cssRules);
        return (colorRules.length) ? `${rule.cssText.match(/^[^{]+/)} { ${colorRules.join("\n")} }` : "";
      break;

      case CSSRule.IMPORT_RULE:
      case 3:
        return rule.styleSheet.cssRules ? getColorRules(rule.styleSheet.cssRules).join("\n") : '';
      break;

      default:
        if (!rule.style)
          return "";
        for (let i = 0; i < rule.style.length; ++i) {
          let property = rule.style[i];
          let value    = rule.style[property];
          let priority = rule.style.getPropertyPriority(property);
          priority = (priority.length > 0) ? "!" + priority : "";
          if (COLOR_REGEX.test(value) || (COLOR_PROPERTY_REGEX.test(property)
                                          && !NOT_PROPERTY_REGEX.test(value)))
            colorRules.push(`${property}:${value}${priority};`);
        }

        if (colorRules.length > 0)
          switch (rule.type) {
            case CSSRule.STYLE_RULE:
            case 1:
              return `${rule.selectorText} { ${colorRules.join("\n")} }`;
            break;
            case CSSRule.KEYFRAME_RULE:
            case 8:
              return `${rule.keyText} { ${colorRules.join("\n")} }`;
            break;
            default:
              return "";
            break;
          }
        else
          return "";
      break;
    }
  }

  export function recolor(css : string) : string {
    const COLOR_REGEX = new RegExp(`${COLOR}|(\\b(${Color.getColorNames().join("|")}|transparent)\\b)`, "ig");

    css = getColorRules(parseCSS(css)).join("\n");

    let colors = css.match(COLOR_REGEX);

    if (!colors)
      return '';

    if (CONFIG.TRANSFORM_FUNCTION) {
      let cs = colors.map(c => ({ color: new Color(c), str: c }))
                     .map(c => ({ str: c.str, rgba: [c.color.r,
                                                     c.color.g,
                                                     c.color.b,
                                                     c.color.a] }));
      let palette = {};
      let color2str = c => `rgba(${c.join(",")})`;
      cs.forEach(c =>
        palette[c.str] = color2str(CONFIG.TRANSFORM_FUNCTION(c.rgba)));
      return css.replace(COLOR_REGEX, (c) => (palette[c]) ? palette[c] : c);
    }

    let palette = Color.transformPalette(colors, CONFIG.MY_COLORS);
    if (CONFIG.URL_SWAP_INCLUDE_REGEX.test(document.URL)
    && !CONFIG.URL_SWAP_EXCLUDE_REGEX.test(document.URL))
      palette = Color.swapColors(palette, CONFIG.MY_SWAP_RULES);

    return css.replace(COLOR_REGEX, (c) => (palette[c]) ? palette[c] : c);
  }

  function addStyle(css : string) : void {
    if (css.length == 0) return;
    let recolor = document.getElementById('recolor');
    if (!recolor) {
      recolor = document.createElement('div');
      document.body.appendChild(recolor);
      recolor.setAttribute('id', 'recolor');
    }

    let s = document.createElement('style');
    s.type = 'text/css';
    recolor.appendChild(s);
    s.textContent = css;
  }

  export function main() : void {
    getStyles((styles) =>
      styles.forEach(style =>
        addStyle(recolor(style))));
  }

  export function addStyleTag(style : HTMLStyleElement) : void {
    if (style.textContent)
      addStyle(recolor(style.textContent));
  }

  export function addLinkTag(link : HTMLLinkElement) : void {
    getData({ url: link.href, callback: s => addStyle(recolor(s)) });
  }

  export function recolorStyle(e : Element) : void {
    let style = e.getAttribute("style");
    if (e.hasAttribute('recolor')) {
      e.removeAttribute('recolor');
      return;
    }
    if (style && !COLOR_REGEX.test(style))
      return;
    let newStyle = recolor(`_{${style}}`).replace(/^_\s*\{\s*|\s*\}$/g, "");
    e.setAttribute('recolor', '');
    e.setAttribute("style", `${style} ${newStyle}`);
  }
}

namespace ReColor {

  function AsyncSemaphore(func: Function) {
    let lock = 0;
    let add = () => lock++;
    let rem = () => { if (--lock == 0) func(); };
    return (f: Function) => {
      add();
      return function () {
        f.apply(this, arguments);
        rem();
      };
    };
  }

  // Define function signatures explicitly with return types
  export function toArray(xs: StyleSheetList): CSSStyleSheet[];
  export function toArray(xs: CSSRuleList): CSSRule[];
  export function toArray<T extends Element>(xs: NodeListOf<T>): T[];
  export function toArray(xs: any): any[]; // Default case

  // Implementation of the toArray function
  export function toArray(xs: any): any[] {
    return Array.prototype.slice.call(xs);
  }

  // Improved version of getStyles using modern fetch API
  export async function getStyles(callback: Function): Promise<void> {
    let styles: string[] = [];
    let links: { style: string; index: number }[] = []; // Explicitly defining type for links array

    const callbackCss = () => {
      styles = styles.concat(links.sort((x, y) => x.index - y.index).map(x => x.style));

      for (let s of toArray(document.querySelectorAll('style')))
        if (s.textContent != null) {
          styles.push(s.textContent);
        }

      callback(styles);
    };

    const asem = AsyncSemaphore(callbackCss);

    for (let s of toArray(document.styleSheets)) {
      try {
        let css = "";

        if (!s.cssRules)
          continue;
        for (let r of toArray(s.cssRules))
          css += r.cssText;

        styles.push(css);
      } catch (e) {
        console.error(e);
      }
    }

    const linkSelector = 'link[href]:not([href=""])[type="text/css"],link[href]:not([href=""])[rel="stylesheet"]';
    let linkTags = <NodeListOf<HTMLLinkElement>>document.querySelectorAll(linkSelector);

    if (linkTags.length === 0)
      callbackCss();

      for (let i = 0; i < linkTags.length; ++i) {
        getData({ url: linkTags[i].href }).then(
          data => asem(i => data => links.push({ style: data, index: i }))
        );
      }      
  }

  export async function getData(params: { url: string; callback?: Function; method?: string; data?: any }): Promise<string> {
    try {
      const response = await fetch(params.url);
      if (response.ok) {
        return await response.text();
      } else {
        console.error(`Failed to fetch data from ${params.url}. Status: ${response.status}`);
        return '';
      }
    } catch (error) {
      console.error(`An error occurred while fetching data from ${params.url}: ${error}`);
      return '';
    }
  }
}

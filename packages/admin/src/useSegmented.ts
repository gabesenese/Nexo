import { useEffect } from "react";

/**
 * Measures the active segment and hands its box to the stylesheet, so the pill
 * behind the labels travels instead of the fill jumping to whichever button was
 * clicked. Segments are text-width, so this cannot be done in CSS alone.
 *
 * Watches resize and content as well as the active value: the labels carry
 * counts that change under the operator, and a segment that grows by a digit
 * would otherwise leave the pill sitting at a stale width. It deliberately does
 * not watch attributes, since it writes its own, and a measurement that is
 * unchanged is dropped before it can touch the DOM.
 */
export function useSegmented(active: string) {
  useEffect(() => {
    const groups = [...document.querySelectorAll<HTMLElement>(".segmented")];
    if (!groups.length) return;

    const place = () => {
      for (const group of groups) {
        const on = group.querySelector<HTMLElement>("button.on");
        if (!on || !on.offsetWidth) {
          group.removeAttribute("data-measured");
          continue;
        }
        const box = [on.offsetLeft, on.offsetTop, on.offsetWidth, on.offsetHeight].join();
        if (group.dataset.segBox === box) continue;
        group.dataset.segBox = box;
        group.style.setProperty("--seg-x", `${on.offsetLeft}px`);
        group.style.setProperty("--seg-y", `${on.offsetTop}px`);
        group.style.setProperty("--seg-w", `${on.offsetWidth}px`);
        group.style.setProperty("--seg-h", `${on.offsetHeight}px`);
        group.setAttribute("data-measured", "true");
      }
    };

    place();

    const resize = new ResizeObserver(place);
    const mutations = new MutationObserver(place);
    for (const group of groups) {
      resize.observe(group);
      mutations.observe(group, { childList: true, subtree: true, characterData: true });
    }

    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [active]);
}

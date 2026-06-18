import { useLayoutEffect, useRef } from 'react';

/**
 * FLIP-Animation: Trim-Karten rutschen bei neuer Sortierung wie beim Mischen.
 * @param {string[]} trimIds – aktuelle Reihenfolge der Trim-IDs
 */
export function useTrimCardShuffle(trimIds) {
  const listRef = useRef(null);
  const prevRectsRef = useRef(new Map());
  const isFirstPaintRef = useRef(true);
  const orderKey = trimIds.join('|');

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const cards = [...list.querySelectorAll('[data-trim-id]')];
    const nextRects = new Map();

    cards.forEach((el) => {
      const id = el.dataset.trimId;
      if (!id) return;
      nextRects.set(id, el.getBoundingClientRect());
    });

    if (isFirstPaintRef.current) {
      isFirstPaintRef.current = false;
      prevRectsRef.current = nextRects;
      return;
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      prevRectsRef.current = nextRects;
      return;
    }

    cards.forEach((el) => {
      const id = el.dataset.trimId;
      const prev = prevRectsRef.current.get(id);
      const next = nextRects.get(id);
      if (!prev || !next) return;

      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

      el.classList.add('vd-eq-trim--shuffling');
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'none';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.48s cubic-bezier(0.22, 1, 0.36, 1)';
          el.style.transform = '';
        });
      });

      const onEnd = (event) => {
        if (event.propertyName !== 'transform') return;
        el.classList.remove('vd-eq-trim--shuffling');
        el.style.transition = '';
        el.style.transform = '';
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd);
    });

    prevRectsRef.current = nextRects;
  }, [orderKey]);

  return listRef;
}

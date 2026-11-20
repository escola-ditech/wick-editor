import React, { useEffect, useRef, useState } from 'react';
import { arrow, autoUpdate, flip, FloatingPortal, offset, shift, useFloating } from '@floating-ui/react';
import { isMobile } from 'react-device-detect';

import './_wicktooltip.scss';

/**
 * Finds the element with a tooltip that the event happened in, if any.
 */
function findAnchor (e) {
  return e.target instanceof Element ? e.target.closest('[data-tooltip-content]') : null;
}

/**
 * The tooltip of the editor. There is only one, shared by every element that has
 * a tooltip, so it must be rendered once.
 *
 * Elements get a tooltip by setting these attributes:
 *   data-tooltip-content="Text"
 *   data-tooltip-place="top", "bottom" (default), "left" or "right"
 */
export default function WickTooltip () {
  // The element the mouse is over, if it has a tooltip.
  const [anchor, setAnchor] = useState(null);
  const arrowRef = useRef(null);

  useEffect(() => {
    // There is no hovering on touch screens.
    if (isMobile) return;

    const show = (e) => {
      const found = findAnchor(e);
      if (found) setAnchor(found);
    };
    const hide = (e) => {
      const found = findAnchor(e);
      // Moving between the children of the element is not leaving it.
      if (!found || (e.relatedTarget instanceof Node && found.contains(e.relatedTarget))) return;
      setAnchor(current => current === found ? null : current);
    };
    const hideAll = () => setAnchor(null);

    document.addEventListener('mouseover', show);
    document.addEventListener('mouseout', hide);
    document.addEventListener('mousedown', hideAll);
    document.addEventListener('scroll', hideAll, true);
    return () => {
      document.removeEventListener('mouseover', show);
      document.removeEventListener('mouseout', hide);
      document.removeEventListener('mousedown', hideAll);
      document.removeEventListener('scroll', hideAll, true);
    };
  }, []);

  const { refs, floatingStyles, middlewareData, placement } = useFloating({
    open: Boolean(anchor),
    placement: (anchor && anchor.getAttribute('data-tooltip-place')) || 'bottom',
    strategy: 'fixed',
    elements: { reference: anchor },
    middleware: [offset(10), flip(), shift({ padding: 4 }), arrow({ element: arrowRef })],
    // Follows the element while the tooltip is shown, and hides the tooltip if the
    // element is removed from the page (it would never report the mouse leaving).
    whileElementsMounted: (reference, floating, update) => autoUpdate(reference, floating, () => {
      if (reference.isConnected) {
        update();
      } else {
        setAnchor(null);
      }
    }, { animationFrame: true }),
  });

  const text = anchor && anchor.getAttribute('data-tooltip-content');
  if (!text) return null;

  const side = placement.split('-')[0];
  const arrowData = middlewareData.arrow || {};
  const arrowStyle = (side === 'top' || side === 'bottom')
    ? { left: arrowData.x != null ? arrowData.x : '' }
    : { top: arrowData.y != null ? arrowData.y : '' };

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        role="tooltip"
        className={'wick-tooltip wick-tooltip-' + side}
        style={floatingStyles}>
        {text}
        <div ref={arrowRef} className="wick-tooltip-arrow" style={arrowStyle} />
      </div>
    </FloatingPortal>
  );
}

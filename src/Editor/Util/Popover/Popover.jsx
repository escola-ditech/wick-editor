import React, { useEffect, useRef, useState } from 'react';
import {
  arrow,
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import classNames from 'classnames';

import './_popover.scss';

// Distance between the popover and its target, the size of the arrow.
const BOOTSTRAP_ARROW_SIZE = 8;
const PLAIN_ARROW_SIZE = 7;

/**
 * A box that floats next to another element, with an arrow pointing at it.
 *
 * prop {boolean} isOpen True if the popover is shown.
 *
 * prop {function} toggle Called when the popover should close, because of a
 * click outside of it and of its target.
 *
 * prop {string|Element} target The element the popover points at, or its id.
 *
 * prop {string} placement 'top', 'bottom', 'left' or 'right'. Defaults to 'bottom'.
 * The other side is used if there is no room.
 *
 * prop {boolean} plain If true, the popover is not styled as a Bootstrap popover:
 * it only has an arrow, and the content brings its own background.
 *
 * prop {string} container Id of the element the popover is added to. Defaults to the page.
 *
 * prop {string} className, id, tabIndex Applied to the popover element.
 */
export default function Popover (props) {
  const placement = props.placement || 'bottom';
  const arrowRef = useRef(null);
  const [reference, setReference] = useState(null);

  // The target is found by id once it is in the page.
  useEffect(() => {
    setReference(typeof props.target === 'string' ? document.getElementById(props.target) : props.target);
  }, [props.target, props.isOpen]);

  const { refs, floatingStyles, context, middlewareData, placement: finalPlacement } = useFloating({
    open: props.isOpen,
    onOpenChange: (open) => {
      if (!open && props.toggle) props.toggle();
    },
    placement: placement,
    elements: { reference: reference },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(props.plain ? PLAIN_ARROW_SIZE : BOOTSTRAP_ARROW_SIZE),
      flip(),
      shift({ padding: 4 }),
      arrow({ element: arrowRef }),
    ],
  });

  const dismiss = useDismiss(context, { escapeKey: false });
  const { getFloatingProps } = useInteractions([dismiss]);

  if (!props.isOpen || !reference) return null;

  const side = finalPlacement.split('-')[0];
  const arrowData = middlewareData.arrow || {};
  const arrowStyle = (side === 'top' || side === 'bottom')
    ? { left: arrowData.x != null ? arrowData.x : '' }
    : { top: arrowData.y != null ? arrowData.y : '' };

  return (
    <FloatingPortal root={props.container ? document.getElementById(props.container) : undefined}>
      <div
        ref={refs.setFloating}
        id={props.id}
        tabIndex={props.tabIndex}
        className={classNames(
          props.plain ? ['wick-plain-popover', 'wick-plain-popover-' + side] : ['popover', 'show', 'bs-popover-' + side],
          'wick-popover',
          props.className)}
        style={floatingStyles}
        {...getFloatingProps({
          // The popover may be rendered inside of its own target (a button), and React
          // sends clicks to the parents in the component tree: this click is not for them.
          onClick: (e) => e.stopPropagation(),
        })}>
        <div
          ref={arrowRef}
          className={props.plain ? 'wick-plain-popover-arrow' : 'arrow'}
          style={arrowStyle} />
        {props.plain ? props.children : <div className="popover-inner">{props.children}</div>}
      </div>
    </FloatingPortal>
  );
}

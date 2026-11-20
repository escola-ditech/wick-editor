import React, { Component } from 'react';

/**
 * Renders its content again every time the element that contains it changes size.
 *
 * prop {function} children Returns what to render.
 */
class SizeWatcher extends Component {
  marker = React.createRef();

  componentDidMount() {
    // An invisible marker is used to find the containing element, so no element
    // that could change the layout has to be added around the content.
    this.observer = new ResizeObserver(() => this.forceUpdate());
    this.observer.observe(this.marker.current.parentElement);
  }

  componentWillUnmount() {
    this.observer.disconnect();
  }

  render() {
    return (
      <>
        <span ref={this.marker} hidden />
        {this.props.children()}
      </>
    );
  }
}

export default SizeWatcher

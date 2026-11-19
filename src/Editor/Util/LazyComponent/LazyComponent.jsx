import React, { Component } from 'react';

// Components that were already downloaded, by the function that loads them.
const loadedComponents = new Map();

/**
 * Shows a component whose code is only downloaded the first time it is shown,
 * so it is not part of the code the editor needs to start.
 *
 * prop {function} load Returns the promise of the module, e.g. () => import('./Big').
 * Must be the same function every time.
 *
 * prop {function} onLoadError Called if the code could not be downloaded, for example
 * when offline. Nothing is shown in that case, and it is tried again the next time.
 *
 * All remaining props are given to the component.
 */
class LazyComponent extends Component {
  state = {
    Loaded: loadedComponents.get(this.props.load),
  }

  componentDidMount() {
    this.mounted = true;
    if (this.state.Loaded) return;

    this.props.load().then(module => {
      loadedComponents.set(this.props.load, module.default);
      if (this.mounted) this.setState({ Loaded: module.default });
    }).catch(error => {
      console.error(error);
      if (this.mounted && this.props.onLoadError) this.props.onLoadError(error);
    });
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  render() {
    let { load, onLoadError, ...rest } = this.props;
    let Loaded = this.state.Loaded;
    return Loaded ? <Loaded {...rest} /> : null;
  }
}

export default LazyComponent

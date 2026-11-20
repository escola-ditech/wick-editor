import React, { useEffect, useRef, useState } from 'react';
import Popover from 'Editor/Util/Popover/Popover';

import WickInput from 'Editor/Util/WickInput/WickInput';
import ToolIcon from 'Editor/Util/ToolIcon/ToolIcon';

import 'Editor/styles/Panels/Toolbox/settingsnumericslider.css';

import classNames from 'classnames';

export default function SettingsNumericSlider (props) {

  const [sliderOn, setSliderOn] = useState(false);

  // The slider is shown below the numeric input.
  const container = useRef(null);
  const [numericInput, setNumericInput] = useState(null);
  useEffect(() => {
    setNumericInput(container.current.querySelector('input.settings-numeric-input'));
  }, []);

  return (
    <div className="settings-numeric-slider" ref={container}>
      <ToolIcon
        name={props.icon}
        className={classNames("settings-numeric-slider-icon", {mobile: props.isMobile})}/>

      <WickInput
        type="numeric"
        className={classNames("settings-numeric-input", {"mobile": props.isMobile})}
        onChange={props.onChange}
        onFocus={() => {setSliderOn(true)}}
        onBlur={() => {setSliderOn(false)}}
        onClick={() => {setSliderOn(true)}}
        value={props.value}
        {...props.inputRestrictions}
      />

      <Popover
        plain
        isOpen={sliderOn}
        placement="bottom"
        target={numericInput}
        toggle={() => {setSliderOn(false)}}
        container="editor">
        <div className="settings-numeric-slider-container">
          <WickInput
            type="slider"
            containerclassname="settings-slider-wick-input-container"
            className="settings-numeric-slider"
            onChange={props.onChange}
            value={props.value}
            {...props.inputRestrictions} />
        </div>
      </Popover>
    </div>
  )
}

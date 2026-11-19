import React from 'react';

import './_savedprojectitem.scss';

import classNames from 'classnames';

export default function SavedProjectItem(props) {
   return (
      <div onClick={props.onClick} className={classNames("saved-project-item", {selected: props.selected})}>
         <h4 className="saved-project-item-name">{props.item.name}</h4>
         {props.item.date instanceof Date &&
            <div className="saved-project-item-detail-container">
               <div className="saved-project-item-date">{props.item.date.toLocaleString()}</div>
               <div className="saved-project-item-size">{Math.max(1, Math.round(props.item.size / 1024))} KB</div>
            </div>
         }
      </div>
   )
}
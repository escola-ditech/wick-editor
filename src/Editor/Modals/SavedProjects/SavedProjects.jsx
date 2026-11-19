import React, { useState } from 'react';

import WickModal from '../WickModal/WickModal';
import ActionButton from '../../Util/ActionButton/ActionButton';

import './_savedprojects.scss';
import SavedProjectItem from './SavedProjectItem/SavedProjectItem';
import classNames from 'classnames';

// Saved files from an account have ids, files saved on the device only have names.
let getKey = (project) => project.id || project.name;

export default function SavedProjects(props) {
  // Use an empty list if saved files are not provided.
  const projects = props.localSavedFiles ? props.localSavedFiles : []

  const [selectedKey, setSelectedKey] = useState(null);

  // The selection only counts while the project is still in the list.
  const selectedProject = projects.find(project => getKey(project) === selectedKey) || null;

  let openSelectedFile = () => {
    props.loadLocalWickFile(selectedProject);
    props.toggle();
  }

  let deleteSelectedFile = () => {
    Promise.resolve(props.deleteLocalWickFile(selectedProject)).then(() => {
      props.reloadSavedWickFiles();
    });
  }

  let openFromFile = () => {
    props.toggle();
    props.openProjectFileFromClient();
  }

  let attemptOpenFile = () => {
    if (props.openWarningModal) {
      props.openWarningModal({
        title: "Lose Unsaved",
        description: "Any unsaved work will be lost.",
        acceptAction: openSelectedFile,
        cancelAction: () => {},
        acceptText: "Open",
        canceltText: "Cancel"
      });
    }
  }

  let attemptDeleteFile = () => {
    if (props.openWarningModal) {
      props.openWarningModal({
        title: `Delete ${selectedProject.name}`,
        description: "This cannot be undone!",
        acceptAction: deleteSelectedFile,
        cancelAction: () => {},
        acceptText: "Delete",
        canceltText: "Cancel"
      });
    }
  }

  return (
    <WickModal
      open={props.open}
      toggle={props.toggle}
      className={classNames("saved-projects-modal-container", props.isMobile && "mobile")}
      overlayClassName="settings-modal-overlay">

      <h3 className="saved-projects-modal-title">
        Saved Projects
      </h3>
      <div className="saved-projects-modal-body">
        {
          projects.map(project => <SavedProjectItem
              key={getKey(project)}
              onClick={() => setSelectedKey(getKey(project))}
              selected={selectedProject === project}
              item={project} />)
        }

        {
          props.loading && "Loading..."
        }

        {
          (!props.loading && projects.length === 0) && "No Saved Files"
        }
      </div>
      <div className="saved-projects-modal-footer">
        <ActionButton
          className="saved-projects-modal-button"
          disabled={selectedProject === null}
          color={selectedProject ? 'red' : 'gray'}
          action={attemptDeleteFile}
          text="Delete"
        />
        {props.openProjectFileFromClient &&
          <ActionButton
            className="saved-projects-modal-button"
            color="gray"
            action={openFromFile}
            text="From file"
          />
        }
        <ActionButton
          className="saved-projects-modal-button"
          disabled={selectedProject === null}
          color={selectedProject ? 'green' : 'gray'}
          action={attemptOpenFile}
          text="Open"
        />
      </div>
    </WickModal>
  )
}

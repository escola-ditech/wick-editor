/*
 * Copyright 2020 WICKLETS LLC
 *
 * This file is part of Wick Editor.
 *
 * Wick Editor is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wick Editor is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wick Editor.  If not, see <https://www.gnu.org/licenses/>.
 */

import React, { Component } from 'react';

import MakeInteractive from '../MakeInteractive/MakeInteractive';
import MakeAnimated from '../MakeAnimated/MakeAnimated';
import ExportOptions from '../ExportOptions/ExportOptions';
import GeneralWarning from '../GeneralWarning/GeneralWarning';
import ExportMedia from '../ExportMedia/ExportMedia';
import SettingsModal from '../SettingsModal/SettingsModal';
import BuiltinLibrary from '../BuiltinLibrary/BuiltinLibrary';
import EditorInfo from '../EditorInfo/EditorInfo';
import MobileMenu from '../MobileMenu/MobileMenu';
import SavedProjects from '../SavedProjects/SavedProjects';
import SimpleProjectSettings from '../SimpleProjectSettings/SimpleProjectSettings';
import LazyComponent from 'Editor/Util/LazyComponent/LazyComponent';

// The license texts are large and rarely read, so they are only downloaded when asked for.
const loadOpenSourceNotices = () => import('../OpenSourceNotices/OpenSourceNotices');

class ModalHandler extends Component {
  onNoticesLoadError = () => {
    this.noticesWereOpened = false;
    this.props.closeActiveModal();
    this.props.toast('Could not load the open source notices. Check your connection and try again.', 'error');
  }

  render() {
    let isMobile = this.props.getRenderSize() === "small";

    // Once opened, the notices stay in the page like the other windows, so closing looks the same.
    this.noticesWereOpened = this.noticesWereOpened || this.props.activeModalName === 'OpenSourceNotices';
    return (
      <div>
        <MakeAnimated
            openModal={this.props.openModal}
            toggle={this.props.closeActiveModal}
            open={this.props.activeModalName === 'MakeAnimated'}
            createClipFromSelection={this.props.createClipFromSelection}
          />
        <MakeInteractive
            openModal={this.props.openModal}
            toggle={this.props.closeActiveModal}
            open={this.props.activeModalName === 'MakeInteractive'}
            createClipFromSelection={this.props.createClipFromSelection}
            createButtonFromSelection={this.props.createButtonFromSelection}
          />
        <ExportOptions
          isMobile={isMobile}
          openModal={this.props.openModal}
          closeActiveModal={this.props.closeActiveModal}
          queueModal={this.props.queueModal}
          toggle={this.props.closeActiveModal}
          exportProjectAsGif={this.props.exportProjectAsGif}
          exportProjectAsStandaloneZip={this.props.exportProjectAsStandaloneZip}
          exportProjectAsStandaloneHTML={this.props.exportProjectAsStandaloneHTML}
          exportProjectAsVideo={this.props.exportProjectAsVideo}
          exportProjectAsImageSequence={this.props.exportProjectAsImageSequence}
          exportProjectAsAudioTrack={this.props.exportProjectAsAudioTrack}
          exportProjectAsImageSVG={this.props.exportProjectAsImageSVG}
          open={this.props.activeModalName === 'ExportOptions'}
          projectName={this.props.project.name}
          project={this.props.project}
          />
        <GeneralWarning
          openModal={this.props.openModal}
          toggle={this.props.closeActiveModal}
          open={this.props.activeModalName === 'GeneralWarning'}
          info={this.props.warningModalInfo}
        />
        <ExportMedia
          openModal={this.props.openModal}
          toggle={this.props.closeActiveModal}
          exportProjectAsVideo={this.props.exportProjectAsVideo}
          open={this.props.activeModalName === 'ExportMedia'}
          renderProgress={this.props.renderProgress}
          renderType={this.props.renderType}
          renderStatusMessage={this.props.renderStatusMessage}
          project={this.props.project}
        />
        <SettingsModal
          isMobile={isMobile}
          openModal={this.props.openModal}
          toggle={this.props.closeActiveModal}
          open={this.props.activeModalName === 'SettingsModal'}
          project={this.props.project}
          updateProjectSettings={this.props.updateProjectSettings}
          addCustomHotKeys={this.props.addCustomHotKeys}
          resetCustomHotKeys={this.props.resetCustomHotKeys}
          keyMap={this.props.keyMap}
          keyMapGroups={this.props.keyMapGroups}
          customHotKeys={this.props.customHotKeys}
          colorPickerType={this.props.colorPickerType}
          changeColorPickerType={this.props.changeColorPickerType}
          updateLastColors={this.props.updateLastColors}
          lastColorsUsed={this.props.lastColorsUsed}
          toast={this.props.toast}
          createCombinedHotKeyMap={this.props.createCombinedHotKeyMap}
          getToolSetting={this.props.getToolSetting}
          setToolSetting={this.props.setToolSetting}
          getToolSettingRestrictions={this.props.getToolSettingRestrictions}
        />
        <BuiltinLibrary
          openModal={this.props.openModal}
          toggle={this.props.closeActiveModal}
          open={this.props.activeModalName === 'BuiltinLibrary'}
          project={this.props.project}
          importFileAsAsset={this.props.importFileAsAsset}
          builtinPreviews={this.props.builtinPreviews}
          addFileToBuiltinPreviews={this.props.addFileToBuiltinPreviews}
          isAssetInLibrary={this.props.isAssetInLibrary}
        />
        <EditorInfo
          openModal={this.props.openModal}
          toggle={this.props.closeActiveModal}
          open={this.props.activeModalName === 'EditorInfo'}
          editorVersion={this.props.editorVersion}
        />
        {this.noticesWereOpened && <LazyComponent
          load={loadOpenSourceNotices}
          onLoadError={this.onNoticesLoadError}
          isMobile={isMobile}
          openModal={this.props.openModal}
          toggle={this.props.closeActiveModal}
          open={this.props.activeModalName === 'OpenSourceNotices'}
          />}
        <MobileMenu
          openProjectFileDialog={this.props.openProjectFileDialog}
          openNewProjectConfirmation={this.props.openNewProjectConfirmation}
          user={this.props.user}
          signIn={this.props.signIn}
          signOut={this.props.signOut}
          downloadProjectAsWickFile={this.props.downloadProjectAsWickFile}
          openModal={this.props.openModal}
          toggle={this.props.closeActiveModal}
          open={this.props.activeModalName === 'MobileMenuModal'}
        />
        <SavedProjects
          openModal={this.props.openModal}
          toggle={this.props.closeActiveModal}
          open={this.props.activeModalName === 'SavedProjects'}
          isMobile={isMobile}
          localSavedFiles={this.props.localSavedFiles}
          loading={this.props.savedFilesLoading}
          openProjectFileFromClient={this.props.user && this.props.openProjectFileFromClient}
          loadLocalWickFile={this.props.loadLocalWickFile}
          deleteLocalWickFile={this.props.deleteLocalWickFile}
          reloadSavedWickFiles={this.props.reloadSavedWickFiles}
          openWarningModal={this.props.openWarningModal}
          />
        <SimpleProjectSettings 
          updateProjectSettings={this.props.updateProjectSettings}
          project={this.props.project}
          toggle={this.props.closeActiveModal}
          open={this.props.activeModalName === 'SimpleProjectSettings'}/>
      </div>
    );
  }
}

export default ModalHandler

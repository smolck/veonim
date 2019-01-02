import * as vsc from 'vscode'

const scm: typeof vsc.scm = {
  get inputBox() {
    console.warn('DEPRECATED: scm.inputBox. Use SourceControl.inputBox instead')
    return { value: '', placeholder: '' }
  },
  createSourceControl: (id, label, rootUri) => SourceControl(id, label, rootUri),
}

const SourceControl = (id: string, label: string, rootUri?: vsc.Uri) => ({
  id,
  label,
  rootUri,
  inputBox: {
    value: '',
    placeholder: '',
  },
  createResourceGroup: () => ({
    id: '',
    label: '',
    resourceStates: [],
    dispose: () => {},
  }),
  dispose: () => {},
})

export default scm

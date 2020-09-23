// TODO: this module is a fake until we figure out how to get
// debug configs from the debug extension itself
export default (debugType: string) => {
  if (debugType === 'node2')
    return {
      type: 'node2',
      request: 'launch',
      name: 'Launch Program',
    }
}
// TODO: SEE DIS WAT DO? "Instead VS Code passes all arguments from the user's launch configuration to the launch or attach requests"

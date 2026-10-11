export class McpOperationNotApplicableError extends Error {
    constructor() {
        super('Operation is not applicable to the plant in this field');
        this.name = 'McpOperationNotApplicableError';
    }
}

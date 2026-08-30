export async function getGardenStackPatchError(response: Response) {
    const responseText = await response.text();
    if (!responseText) {
        return 'Failed to update garden blocks';
    }

    try {
        const parsedResponse: unknown = JSON.parse(responseText);
        if (
            parsedResponse !== null &&
            typeof parsedResponse === 'object' &&
            'error' in parsedResponse &&
            typeof parsedResponse.error === 'string'
        ) {
            return parsedResponse.error;
        }
    } catch {
        // Preserve a bounded plain-text server response below.
    }

    return responseText.slice(0, 512);
}

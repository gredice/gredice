type ButtonStyle = 'button' | 'card' | 'icon' | 'plain';

export type CommunityEditButtonProps = {
    entityTypeName:
        | 'block'
        | 'operation'
        | 'plant'
        | 'plantDisease'
        | 'plantPest'
        | 'plantSort';
    entityId: number;
    publicPath: string;
    sectionKey?: string;
    fieldKey?: string;
    /** Public name of the page being edited, shown in the dialog header. */
    entityName?: string;
    /** Public name of the section being edited, shown in the dialog header. */
    sectionLabel?: string;
    label?: string;
    /**
     * `icon` is a bare pencil, `button` an outlined button, `plain` a text
     * button for bars that already have a border, and `card` the dashed
     * suggestion card for grids.
     */
    buttonStyle?: ButtonStyle;
    className?: string;
};

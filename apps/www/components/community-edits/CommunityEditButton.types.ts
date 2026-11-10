type ButtonStyle = 'button' | 'card' | 'icon';

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
    label?: string;
    buttonStyle?: ButtonStyle;
    className?: string;
};

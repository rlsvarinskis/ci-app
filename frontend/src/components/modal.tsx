import React from 'react';

interface ModalProps {
    onClose?: () => void;
};

export default class Modal extends React.Component<ModalProps> {
    render() {
        return <div onClick={evt => {
            const targetCN = (evt.target as HTMLElement).className;
            if (targetCN === "modalaligner" || targetCN === "modalcontainer") {
                if (this.props.onClose != null) {
                    this.props.onClose();
                }
            }
        }} className="modalcontainer">
            <div className="modalaligner">
                <div className="modal">
                    {this.props.children}
                </div>
            </div>
        </div>
    }
}
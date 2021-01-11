import React from 'react';
import styles from './index.less';

interface CloneMenuProps {
    sshClone: string;
    httpClone: string;
};

interface CloneMenuState {
    open: boolean;
    sshButton: "GREEN" | "TRANSITION" | "GRAY";
    httpButton: "GREEN" | "TRANSITION" | "GRAY";
};

export class CloneMenu extends React.Component<CloneMenuProps, CloneMenuState> {
    sshRef = React.createRef<HTMLInputElement>();
    httpRef = React.createRef<HTMLInputElement>();
    popupRef = React.createRef<HTMLDivElement>();

    state: CloneMenuState = {
        open: false,
        sshButton: "GRAY",
        httpButton: "GRAY",
    };

    componentDidMount() {
        document.addEventListener('mousedown', this.handleClick.bind(this));
    }

    componentWillUnmount() {
        document.removeEventListener('mousedown', this.handleClick.bind(this));
    }

    handleClick(evt: MouseEvent) {
        if (this.popupRef.current != null) {
            if (evt.target instanceof Node && !this.popupRef.current.contains(evt.target)) {
                this.setState({
                    open: false,
                    sshButton: "GRAY",
                    httpButton: "GRAY",
                });
            }
        }
    }

    render() {
        function inputClickHandler(evt: React.MouseEvent<HTMLInputElement, MouseEvent>) {
            evt.currentTarget.focus();
            evt.currentTarget.setSelectionRange(0, evt.currentTarget.value.length);
            return true;
        }

        const copyClickHandler = (ref: React.RefObject<HTMLInputElement>, which: "sshButton" | "httpButton") => {
            if (ref.current == null) {
                return;
            }
            ref.current.focus();
            ref.current.setSelectionRange(0, ref.current.value.length);
            document.execCommand('copy');

            this.setState(state => ({
                ...state,
                [which]: "GREEN"
            }));

            setTimeout(() => {
                this.setState(state => ({
                    ...state,
                    [which]: "TRANSITION",
                }));
                setTimeout(() => {
                    this.setState(state => ({
                        ...state,
                        [which]: "GRAY",
                    }));
                }, 200);
            }, 0);
        }

        const focusHandler = () => {
            this.setState({
                open: true,
                sshButton: "GRAY",
                httpButton: "GRAY",
            });
        };

        function getAttributes(state: "GREEN" | "TRANSITION" | "GRAY") {
            switch (state) {
                case "GREEN":
                    return {"data-green": true};
                case "TRANSITION":
                    return {"data-tapped": true};
                case "GRAY":
                    return {};
            }
        }
        const sshAttrs = getAttributes(this.state.sshButton);
        const httpAttrs = getAttributes(this.state.httpButton);

        return <div ref={this.popupRef}>
            <div {...(this.state.open ? {"data-opened": true} : {})} className={styles.clonebutton} onClick={focusHandler}><i className="fas fa-download" />Clone</div>
            {this.state.open ? <div className={styles.clonemenu}>
                    <div className={styles.copytype}>SSH:</div>
                    <div className={styles.copycontainer}>
                        <input ref={this.sshRef} value={this.props.sshClone} readOnly={true} onClick={inputClickHandler} {...sshAttrs} />
                        <div onClick={() => copyClickHandler(this.sshRef, "sshButton")} {...sshAttrs}>
                            <i className="far fa-copy"/>
                        </div>
                    </div>
                    <div className={styles.copytype}>HTTPS:</div>
                    <div className={styles.copycontainer}>
                        <input ref={this.httpRef} value={this.props.httpClone} readOnly={true} onClick={inputClickHandler} {...httpAttrs} />
                        <div onClick={() => copyClickHandler(this.httpRef, "httpButton")} {...httpAttrs}>
                            <i className="far fa-copy" />
                        </div>
                    </div>
                </div> : <></>
            }
        </div>;
    }
}
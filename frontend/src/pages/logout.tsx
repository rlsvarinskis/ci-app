import Page from 'components/page';
import React from 'react';

interface LogoutProps {
    onLogout: () => void;
}

export default class Logout extends React.Component<LogoutProps, {
    loggingOut: boolean,
    errored: any,
}> {
    constructor(props: LogoutProps) {
        super(props);
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/logout");
        xhr.responseType = "json";
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.props.onLogout();
                } else {
                    this.setState({
                        loggingOut: false,
                        errored: xhr.response,
                    });
                }
            }
        };
        this.state = {
            loggingOut: true,
            errored: null,
        };
        xhr.send();
    }

    render() {
        if (this.state.errored) {
            return <Page><h1>Error!</h1><p>{this.state.errored?.message}</p></Page>
        } else if (this.state.loggingOut) {
            return <Page><h1>Logging out...</h1></Page>
        } else {
            return <Page><h1>Logging out</h1></Page>
        }
    }
}
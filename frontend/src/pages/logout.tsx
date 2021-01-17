import Page from 'components/page';
import React from 'react';
import { FailResponses, post } from 'utils/xhr';
import ErrorPage from 'pages/error';

interface LogoutProps {
    onLogout: () => void;
}

interface LogoutState {
    state: true | FailResponses;
}

export default class Logout extends React.Component<LogoutProps, LogoutState> {
    state: LogoutState = {
        state: true
    };

    componentDidMount() {
        post("/api/logout", undefined).then(result => {
            if (result.type === "success") {
                this.props.onLogout();
            } else {
                this.setState({
                    state: result
                });
            }
        });
    }

    render() {
        if (this.state.state === true) {
            return <Page>
                <h2>Logging out...</h2>
            </Page>;
        } else {
            return <ErrorPage error={this.state.state} />;
        }
    }
}
import Page from 'components/page';
import React from 'react';
import { Redirect, useParams } from 'react-router-dom';

interface VerifyProps {
    username: string;
    verifyKey?: string;
};

interface VerifyState {
    username: string;
    propKey?: string;
    verifyKey: string;
    verifying?: "verifying" | "verified";
    error: any;
};

export default class Verify extends React.Component<VerifyProps, VerifyState> {
    state: VerifyState = {
        username: "",
        verifyKey: "",
        error: null,
    };

    constructor(props: VerifyProps) {
        super(props);
        this.state.username = props.username;
        this.state.propKey = props.verifyKey;
        this.state.verifyKey = props.verifyKey || "";
        if (this.state.verifyKey.length >= 22) {
            this.state.verifyKey = this.state.verifyKey.substr(0, 22);
            this.state.verifying = "verifying";
            this.verifyKey(this.state.verifyKey);
        }
    }

    static getDerivedStateFromProps(props: VerifyProps, state: VerifyState) {
        if (props.username === state.username && props.verifyKey === state.propKey) {
            return state;
        }
        var verifyKey = props.verifyKey || "";
        if (verifyKey.length > 22) {
            verifyKey = verifyKey.substr(0, 22);
        }
        return {
            username: props.username,
            propKey: props.verifyKey,
            verifyKey: verifyKey,
            verifying: state.verifying,
            error: state.error,
        };
    }

    verifyKey(key: string) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/users/" + this.state.username + "/verify");
        xhr.responseType = "json";
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => ({...state, verifying: "verified"}));
                } else {
                    this.setState(state => ({...state, verifying: undefined, error: xhr.response}))
                }
            }
        }
        xhr.send(key);
    }

    updateKey(newKey: string) {
        if (newKey.length == 22) {
            this.setState(state => ({...state, verifying: "verifying", verifyKey: newKey, error: null}));
            this.verifyKey(newKey);
        } else {
            this.setState(state => ({...state, verifyKey: newKey, error: null}));
        }
    }

    render() {
        if (this.state.verifying === "verified") {
            return <Page>
                <h1>Verified account!</h1>
                <Redirect to="/login"></Redirect>
            </Page>
        }
        return <Page>
            <h1>Verify account</h1>
            <p>Username: <input name="username" value={this.state.username} disabled={true}></input></p>
            <p>Activation key: <input disabled={this.state.verifying != null} name="key" size={22} value={this.state.verifyKey} onInput={evt => this.updateKey(evt.currentTarget.value)}></input></p>
        </Page>;
    }
}
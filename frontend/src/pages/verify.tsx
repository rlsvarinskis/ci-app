import Navbar from 'components/navbar';
import { ProfileItem } from 'components/navbar/item';
import RowInput from 'components/rowinput';
import React from 'react';
import { Redirect } from 'react-router-dom';
import { FailResponses, request } from 'utils/xhr';
import styles from './account/account.less';

interface VerifyProps {
    username: string;
    verifyKey?: string;
};

interface VerifyState {
    propKey?: string;
    verifyKey: string;
    state: null | "verifying" | "verified" | FailResponses;
};

export default class Verify extends React.Component<VerifyProps, VerifyState> {
    state: VerifyState = {
        verifyKey: "",
        state: null,
    };

    static getDerivedStateFromProps(props: VerifyProps, state: VerifyState) {
        if (props.verifyKey === state.propKey) {
            return state;
        }
        var verifyKey = props.verifyKey || "";
        if (verifyKey.length > 22) {
            verifyKey = verifyKey.substr(0, 22);
        }
        return {
            propKey: props.verifyKey,
            verifyKey: verifyKey,
            state: null
        };
    }

    componentDidMount() {
        let key = this.props.verifyKey || "";
        if (key.length >= 22) {
            key = key.substr(0, 22);
            
            this.setState({
                propKey: this.props.verifyKey,
                verifyKey: key,
                state: "verifying"
            });
            this.verifyKey(key);
        } else {
            this.setState({
                propKey: this.props.verifyKey,
                verifyKey: key
            });
        }
    }

    verifyKey(key: string) {
        request("POST", "/api/users/" + encodeURIComponent(this.props.username) + "/verify", key).then(result => {
            if (result.type === "success") {
                this.setState({
                    state: "verified"
                });
            } else {
                this.setState({
                    state: result
                });
            }
        });
    }

    updateKey(newKey: string) {
        if (newKey.length == 22) {
            this.setState({
                state: "verifying",
                verifyKey: newKey
            });
            this.verifyKey(newKey);
        } else {
            this.setState({
                state: null,
                verifyKey: newKey
            });
        }
    }

    render() {
        if (this.state.state === "verified") {
            return <>
                <Navbar user={{username: "", email: ""}}><ProfileItem path={"/verify/" + this.props.username}>{this.props.username}</ProfileItem></Navbar>
                <h2>Verified account!</h2>
                <Redirect to="/login"></Redirect>
            </>
        } else {
            return <>
                <Navbar user={{username: "", email: ""}}><ProfileItem path={"/verify/" + this.props.username}>{this.props.username}</ProfileItem></Navbar>
                <div className={styles.page}>
                    <div className={styles.formpage}>
                        <h2>Verify account</h2>
                        <RowInput type="text" value={this.props.username} disabled={true}>Username</RowInput>
                        <RowInput type="text" maxLength={22} disabled={this.state.state === "verifying"} value={this.state.verifyKey} onChange={evt => this.updateKey(evt.currentTarget.value)}>Activation key</RowInput>
                    </div>
                </div>
            </>;
        }
    }
}
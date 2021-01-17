import { User } from "App";
import Navbar from "components/navbar";
import React from "react";
import { LoginItem } from 'components/navbar/item';
import { FailResponses, post, request } from "utils/xhr";
import styles from './form/form.less';
import RowInput from "components/rowinput";
import FormSubmit from "components/formsubmit";

interface LoginProps {
    onLogin: (user: User) => void;
};

interface LoginState {
    username: string;
    password: string;
    remember: boolean;

    loggingIn: boolean;
    loggedIn: boolean;
    error: FailResponses | null;
};

export default class Login extends React.Component<LoginProps, LoginState> {
    state: LoginState = {
        username: "",
        password: "",
        remember: false,
        loggingIn: false,
        loggedIn: false,
        error: null,
    };

    submit() {
        const res = {
            username: this.state.username,
            password: this.state.password,
            remember: this.state.remember,
        };

        post("/api/login", res).then(result => {
            if (result.type === "success") {
                request<User>("GET", "/api/login").then(result2 => {
                    if (result2.type === "success") {
                        this.props.onLogin(result2.data);
                    } else {
                        this.setState({
                            loggingIn: false,
                            error: result2,
                        });
                    }
                });
            } else {
                this.setState({
                    loggingIn: false,
                    error: result,
                })
            }
        });
        this.setState({
            loggingIn: true,
            error: null,
        });
    }

    render() {
        let errors = <></>;
        if (this.state.error?.type === "failed") {
            errors = <>
                {this.state.error.message}
            </>;
        } else if (this.state.error?.type === "bad") {
            errors = <>Server responded with malformed message</>;
        } else if (this.state.error?.type === "error") {
            errors = <>Client side error occured: {this.state.error.error.toString()}</>;
        }

        return <>
            <Navbar user={{username: "", email: ""}}><LoginItem path={"/login"}>Login</LoginItem></Navbar>
            <div className={styles.page}>
                <div className={styles.formpage}>
                    <form onSubmit={evt => {evt.preventDefault(); this.submit(); return false;}}>
                        <h2 className={styles.title}>Login</h2>
                        <RowInput type="text" value={this.state.username} onChange={evt => this.setState({username: evt.currentTarget.value})}>Username</RowInput>
                        <RowInput type="password" value={this.state.password} onChange={evt => this.setState({password: evt.currentTarget.value})}>Password</RowInput>
                        <label className={styles.formrow}><input type="checkbox" checked={this.state.remember} onChange={evt => this.setState({remember: evt.currentTarget.checked})} /> Remember me</label>
                        {errors}
                        <FormSubmit disabled={this.state.loggingIn} onClick={() => this.submit()}>Login</FormSubmit>
                    </form>
                </div>
            </div>
        </>;
    }
}
import Page from "components/page";
import React from "react";
import { RegisterItem } from "components/navbar/item";
import Navbar from "components/navbar";
import { FailResponses, post } from "utils/xhr";
import styles from './form/form.less';
import RowInput from "components/rowinput";
import FormSubmit from "components/formsubmit";

interface RegisterState {
    state: "registering" | boolean | FailResponses;
    email: string;
    username: string;
    password: string;
    password2: string;
};

export default class Register extends React.Component<{}, RegisterState> {
    state: RegisterState = {
        state: false,
        email: "",
        username: "",
        password: "",
        password2: ""
    };

    submit() {
        if (this.state.password !== this.state.password2) {
            this.setState({
                state: {
                    type: "failed",
                    code: 0,
                    result: "invalid_request",
                    message: "Passwords do not match!"
                },
            });
            return;
        }
        
        const res = {
            email: this.state.email,
            username: this.state.username,
            password: this.state.password,
        };

        post("/api/users", res).then(result => {
            if (result.type === "success") {
                this.setState({
                    state: true
                });
            } else {
                this.setState({
                    state: result
                });
            }
        });
        this.setState({
            state: "registering"
        });
    }

    render() {
        if (this.state.state === true) {
            return <>
                <Navbar user={{username: "", email: ""}}><RegisterItem path={"/register"}>Register</RegisterItem></Navbar>
                <div className={styles.page}>
                    <div className={styles.formpage}>
                        <h2>You have registered.</h2>
                        <p>An email has been sent to your account with activation instructions.</p>
                    </div>
                </div>
            </>;
        } else {
            return <>
                <Navbar user={{username: "", email: ""}}><RegisterItem path={"/register"}>Register</RegisterItem></Navbar>
                <div className={styles.page}>
                    <div className={styles.formpage}>
                        <form onSubmit={evt => {evt.preventDefault(); this.submit(); return false;}}>
                            <h2 className={styles.title}>Register</h2>
                            <RowInput type="email" value={this.state.email} onChange={evt => this.setState({email: evt.currentTarget.value})}>Email</RowInput>
                            <RowInput type="text" value={this.state.username} onChange={evt => this.setState({username: evt.currentTarget.value})}>Username</RowInput>
                            <RowInput type="password" value={this.state.password} onChange={evt => this.setState({password: evt.currentTarget.value})}>Password</RowInput>
                            <RowInput type="password" value={this.state.password2} onChange={evt => this.setState({password2: evt.currentTarget.value})}>Repeat password</RowInput>
                            {this.state.state !== false && this.state.state !== "registering" ? <>{JSON.stringify(this.state.state)}</> : <></>}
                            <FormSubmit disabled={this.state.state === "registering"} onClick={() => this.submit()}>Register</FormSubmit>
                        </form>
                    </div>
                </div>
            </>;
        }
    }
}
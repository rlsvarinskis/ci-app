import { User } from "App";
import Navbar from "components/navbar";
import Page from "components/page";
import React from "react";
import { LoginItem } from 'components/navbar/item';
import { FailResponses, post, request } from "utils/xhr";

interface LoginProps {
    onLogin: (user: User) => void;
};

export default class Login extends React.Component<LoginProps> {
    state: {loggingIn: boolean, loggedIn: boolean, error: FailResponses | null} = {
        loggingIn: false,
        loggedIn: false,
        error: null,
    };

    submit(evt: React.FormEvent<HTMLFormElement>) {
        evt.preventDefault();
        const el = evt.currentTarget.elements;
        
        const res = {
            username: (el.namedItem("username") as any).value,
            password: (el.namedItem("password") as any).value,
            remember: (el.namedItem("remember") as any).checked,
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

        return false;
    }

    render() {
        let errors = <></>;
        if (this.state.error?.type === "failed") {
            errors = <>
                {this.state.error.message}
            </>;
        } else if (this.state.error?.type === "bad") {
            errors = <>Server responded with malformed message</>
        } else if (this.state.error?.type === "error") {
            errors = <>Client side error occured: {this.state.error.error.toString()}</>
        }

        return <>
            <Navbar user={{username: "", email: ""}}><LoginItem path={"/login"}>Login</LoginItem></Navbar>
            <Page>
                <h1>Login</h1>
                <form onSubmit={(evt) => this.submit(evt)}>
                    <p>Username: <input name="username" type="username"></input></p>
                    <p>Password: <input name="password" type="password"></input></p>
                    <p>Remember me: <input name="remember" type="checkbox"></input></p>
                    <input type="submit" value="Login" disabled={this.state.loggingIn}></input>
                    {errors}
                </form>
            </Page>
        </>;
    }
}
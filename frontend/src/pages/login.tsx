import { User } from "App";
import Navbar from "components/navbar";
import Page from "components/page";
import React from "react";
import { LoginItem } from 'components/navbar/item';

interface LoginProps {
    onLogin: (user: User) => void;
};

export default class Login extends React.Component<LoginProps> {
    state: {loggingIn: boolean, loggedIn: boolean, error: any} = {
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

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/login");
        xhr.responseType = "json";
        xhr.onreadystatechange = (ev) => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    var xhr2 = new XMLHttpRequest();
                    xhr2.open("GET", "/api/login");
                    xhr2.responseType = "json";
                    xhr2.onreadystatechange = (ev) => {
                        if (xhr2.readyState === XMLHttpRequest.DONE) {
                            if (xhr2.status === 200) {
                                this.props.onLogin(xhr2.response.data);
                            } else {
                                this.setState({
                                    loggingIn: false,
                                    error: xhr2.response,
                                });
                            }
                        }
                    };
                    xhr2.send();
                } else {
                    this.setState({
                        loggingIn: false,
                        error: xhr.response,
                    })
                    //Error!
                }
            }
        }
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.send(JSON.stringify(res));
        this.setState({
            loggingIn: true,
            error: null,
        });

        return false;
    }

    render() {
        return <>
            <Navbar user={{username: "", email: ""}}><LoginItem path={"/login"}>Login</LoginItem></Navbar>
            <Page>
                <h1>Login</h1>
                <form onSubmit={(evt) => this.submit(evt)}>
                    <p>Username: <input name="username" type="username"></input></p>
                    <p>Password: <input name="password" type="password"></input></p>
                    <p>Remember me: <input name="remember" type="checkbox"></input></p>
                    <input type="submit" value="Login" disabled={this.state.loggingIn}></input>
                    {this.state.error != null ? <>{this.state.error.message}</> : <></>}
                </form>
            </Page>
        </>;
    }
}
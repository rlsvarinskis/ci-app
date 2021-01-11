import Page from "components/page";
import React from "react";
import { Redirect } from "react-router-dom";

export default class Register extends React.Component {
    state: {registering: boolean, registered: boolean, error: any} = {
        registering: false,
        registered: false,
        error: null,
    };

    submit(evt: React.FormEvent<HTMLFormElement>) {
        evt.preventDefault();
        const el = evt.currentTarget.elements;

        if ((el.namedItem("password") as any).value !== (el.namedItem("password2") as any).value) {
            this.setState({
                registering: false,
                registered: false,
                error: {
                    status: 0,
                    message: "Passwords do not match!",
                },
            });
            return false;
        }
        
        const res = {
            email: (el.namedItem("email") as any).value,
            username: (el.namedItem("username") as any).value,
            password: (el.namedItem("password") as any).value,
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/users");
        xhr.responseType = "json";
        xhr.onreadystatechange = (ev) => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState({
                        registering: false,
                        registered: true,
                        error: null,
                    });
                    //Registered!
                } else {
                    this.setState({
                        registering: false,
                        registered: false,
                        error: xhr.response,
                    })
                    //Error!
                }
            }
        }
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.send(JSON.stringify(res));
        this.setState({
            registering: true,
            registered: false,
            error: null,
        });

        return false;
    }

    render() {
        if (this.state.registered) {
            return <Page>
                <h1>You have registered.</h1>
                <p>An activation key has been sent to your email. Activate your account to login.</p>
            </Page>
        } else {
            return <Page>
                <h1>Register</h1>
                <form onSubmit={(evt) => this.submit(evt)}>
                    <p>Email: <input name="email" type="email"></input></p>
                    <p>Username: <input name="username" type="username"></input></p>
                    <p>Password: <input name="password" type="password"></input></p>
                    <p>Repeat password: <input name="password2" type="password"></input></p>
                    <input type="submit" value="Login" disabled={this.state.registering}></input>
                    {this.state.error != null ? <>{this.state.error.message}</> : <></>}
                </form>
            </Page>;
        }
    }
}
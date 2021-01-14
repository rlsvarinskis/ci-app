import Navbar from 'components/navbar';
import Page from 'components/page';
import ProjectList from 'components/projectlist';
import Login from 'pages/login';
import Logout from 'pages/logout';
import ProjectPage from 'pages/project';
import Register from 'pages/register';
import UserPage from 'pages/user/user';
import Verify from 'pages/verify';
import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect, useParams, useLocation } from 'react-router-dom';
import * as styles from 'App.less';
import HomePage from 'pages/home';

styles;

export interface User {
    username: string;
    email: string;
};

interface AppState {
    user: User | null | "error";
};

function RedirectBack() {
    const loc = useLocation();
    return <Redirect to={typeof loc.state === 'object' && loc.state != null && "back" in loc.state ? (loc.state as any).back : "/"}></Redirect>
}

export default class App extends React.Component<{}, AppState, any> {
    state: AppState = {
        user: null,
    };
    
    render() {
        if (this.state.user == null) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "/api/login");
            xhr.responseType = "json";
            xhr.setRequestHeader("Content-type", "text/plain");
            xhr.onreadystatechange = evt => {
                if (xhr.readyState == XMLHttpRequest.DONE) {
                    const response = xhr.response;
                    if (xhr.status === 200) {
                        this.setState({
                            ...this.state,
                            user: response.data,
                        });
                    } else {
                        if (response.type === "no_session") {
                            this.setState({
                                ...this.state,
                                user: {
                                    username: "",
                                    email: "",
                                },
                            });
                        } else {
                            this.setState({
                                ...this.state,
                                user: "error",
                            });
                        }
                    }
                }
            }
            xhr.send();
        }

        if (this.state.user === "error") {
            return <Page>
                <h1>An unexpected error occured</h1>
                <p>Please refresh the page</p>
            </Page>;
        } else if (this.state.user == null) {
            return <Page>
                <h1>Loading...</h1>
            </Page>
        }

        /*function NavbarLocation(props: {user: User}) {
            const loc = useLocation();
            return <Navbar user={props.user} location={loc.pathname.split("/").filter(x => x.length > 0)}></Navbar>;
        }*/

        function VerifyLocation() {
            const loc = useLocation();
            const { username } = useParams<{username: string}>();
            return <Verify username={username} verifyKey={new URLSearchParams(loc.search).get("key") || undefined}></Verify>;
        }

        function UsersLocation(props: {user: User}) {
            const loc = useLocation();
            const { username } = useParams<{username: string}>();
            return <UserPage target={username} user={props.user}></UserPage>
        }
        
        var user = this.state.user;
        
        return <Router>
            <Switch>
                <Route path="/login">
                    {this.state.user.username === "" ? <Login onLogin={user => this.setState(state => ({...state, user: user}))}></Login> : <RedirectBack></RedirectBack>}
                </Route>
                <Route path="/register">
                    {this.state.user.username === "" ? <Register></Register> : <Redirect to="/"></Redirect>}
                </Route>
                <Route path="/verify/:username">
                    {this.state.user.username === "" ? () => <VerifyLocation></VerifyLocation> : <Redirect to="/"></Redirect>}
                </Route>
                <Route path="/logout">
                    {this.state.user.username !== "" ? <Logout onLogout={() => this.setState(state => ({...state, user: {
                        username: "",
                        email: "",
                    }}))}></Logout> : <Redirect to="/"></Redirect>}
                </Route>
                <Route path="/users/:username">
                    <UsersLocation user={this.state.user}></UsersLocation>
                </Route>
                <Route path="/p/:project" render={props => <ProjectPage {...props} parent={[]} user={user}></ProjectPage>}></Route>
                <Route path="/">
                    <HomePage user={this.state.user}></HomePage>
                </Route>
            </Switch>
        </Router>;
    }
}
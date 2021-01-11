import { User } from 'App';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './style.less';

interface NavbarProps {
    location: string[];
    user: User;
};

function LoginBack() {
    const loc = useLocation();
    return <div>
        <Link to={{
            pathname: "/login",
            state: {
                back: loc
            }
        }}>Login</Link>
        <Link to={{
            pathname: "/register",
            state: {
                back: loc
            }
        }}>Register</Link>
    </div>;
}

export default class Navbar extends React.Component<NavbarProps> {
    render() {
        return <nav className={styles.navbar}>
            <div>
                <Link to="/">CI Project</Link>
            </div>
            <div className={styles.center}>
                {...this.props.location.map((x, i) => <Link key={i + ":" + x} to="/">{x}</Link>)}
            </div>
            {this.props.user.username !== "" ? (
                <div>
                    <Link style={{paddingLeft: "1.5rem"}} to={"/users/" + encodeURIComponent(this.props.user.username)}>
                        <img src={"/api/users/" + encodeURIComponent(this.props.user.username) + "/avatar"} className={styles.profileimage}></img>
                        {this.props.user.username}
                    </Link>
                    <Link className={styles.logout} to="/logout"><i className="fas fa-power-off"></i>Logout</Link>
                </div>
            ) : <LoginBack></LoginBack>}
        </nav>;
    }
};
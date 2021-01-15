import React from 'react';
import { Link } from 'react-router-dom';
import styles from './useritem.less';

interface UserItemProps {
    username: string;
};

interface FileItemProps {
    filename: string;
    target: (() => void) | string;
    icon: {
        type: "mime",
        mime: string,
    } | {
        type: "url",
        url: string,
    };
};

export class UserItem extends React.Component<UserItemProps> {
    render() {
        return <Link to={"/users/" + this.props.username} className={styles.useritem}><img src={"/api/users/" + this.props.username + "/avatar"} className={styles.usericon}></img>{this.props.username}</Link>;
    }
}

export class FileItem extends React.Component<FileItemProps> {
    render() {
        const t = this.props.target;
        if (typeof t === "function") {
            return <a href="#" onClick={() => t()} className={styles.useritem}><img src={this.props.icon.type === "url" ? this.props.icon.url : ""} className={styles.usericon}></img>{this.props.filename}<i className={"fas fa-file-download " + styles.filedownload}></i></a>;
        } else {
            return <a href={t} target="_blank" className={styles.useritem}><img src={this.props.icon.type === "url" ? this.props.icon.url : ""} className={styles.usericon}></img>{this.props.filename}<i className={"fas fa-file-download " + styles.filedownload}></i></a>;
        }
    }
}

export class EmptyItem extends React.Component {
    render() {
        return <div className={styles.empty}>{this.props.children}</div>
    }
}
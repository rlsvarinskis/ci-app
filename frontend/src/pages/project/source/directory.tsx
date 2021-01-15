import React from 'react';
import { Link } from 'react-router-dom';
import styles from './directory.less';

interface DirectoryProps {
    baseUrl: string;
    content: Blob;
};

interface DirectoryState {
    folders?: {
        mode: string;
        type: string;
        name: string;
    }[];
    lastContent?: Blob;
};

export class ViewDirectory extends React.Component<DirectoryProps, DirectoryState> {
    state: DirectoryState = {};

    componentDidMount() {
        this.reload();
    }

    componentDidUpdate() {
        this.reload();
    }

    reload() {
        const content = this.props.content;
        if (this.state.lastContent !== content) {
            content.text().then(result => {
                this.setState({
                    folders: result.split("\n").map(x => {
                        var fold = x.trim().split(" ");
                        return {
                            mode: fold[0],
                            type: fold[1],
                            name: fold[2]
                        };
                    }),
                    lastContent: content
                });
            }, error => {
                console.error(error);
            });
        }
    }

    render() {
        return <div className={styles.filetable}>
            {
                ...(this.state.folders != null ? this.state.folders.map(folder => {
                    return <Link className={styles.file} key={this.props.baseUrl + "/" + folder.name} to={this.props.baseUrl + "/" + folder.name}>
                        <div className={styles.filecontainer}>
                            <i className={folder.type === "tree" ? "fas fa-folder" : "fas fa-file"} />{folder.name}
                        </div>
                    </Link>;
                }) : [])
            }
        </div>
    }
}
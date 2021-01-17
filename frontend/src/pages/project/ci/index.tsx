import React from 'react';
import page from 'pages/project/page/page.less';
import ProjectSidebar from 'components/sidebar';
import Navbar from 'components/navbar';
import { CIItem, SuccessItem, LoadingItem } from 'components/navbar/item';
import { getAPIURL, getBaseURL, ProjectName, ProjectNavbarItems, ProjectPageProps } from '../common';
import { FailResponses, request, Response, SuccessfulResponse } from 'utils/xhr';
import { Link } from 'react-router-dom';
import { equalArrays } from '../providers';
import { XTerm } from 'xterm-for-react';

export class ProjectCIPage extends React.Component<ProjectPageProps> {
    render() {
        return <>
            <Navbar user={this.props.user}><ProjectNavbarItems project={this.props.project} /><CIItem path={getBaseURL(this.props.project, "ci")}>Scripts</CIItem></Navbar>
            <ProjectSidebar baseurl={getBaseURL(this.props.project)} active="ci"></ProjectSidebar>
            <div className={page.content}>
                <div className={page.page}>
                    <ProjectPushList project={this.props.project} user={this.props.user}>{this.props.children}</ProjectPushList>
                </div>
            </div>
        </>
    }
}

interface ProjectPush {
    id: number;
    username: string;
    processing: boolean;
    time: string;
};

interface ProjectPushState {
    pushes: ProjectPush[];
    loading?: true | FailResponses;
};

class ProjectPushList extends React.Component<ProjectPageProps, ProjectPushState> {
    state: ProjectPushState = {
        pushes: [],
        loading: true,
    };

    componentDidMount() {
        this.loadMore();
    }

    loadMore() {
        const bestPush = this.state.pushes.length === 0 ? "" : "?after=" + this.state.pushes[this.state.pushes.length - 1].id;
        request<ProjectPush[]>("GET", getAPIURL(this.props.project, "pushes") + bestPush).then(result => {
            if (result.type === "success") {
                this.setState(state => ({
                    loading: undefined,
                    pushes: [...state.pushes, ...result.data]
                }));
            } else {
                this.setState({
                    loading: result
                });
            }
        });
        this.setState({
            loading: true
        });
    }

    render() {
        return <>
            {...this.state.pushes.map(push => {
                return <ProjectPushRow key={push.id} project={this.props.project} push={push} />
            })}
            {this.state.loading != null && this.state.loading !== true ? JSON.stringify(this.state.loading) : ""}
            <button disabled={this.state.loading === true} onClick={() => this.loadMore()}>Load more</button>
        </>
    }
}

class ProjectPushRow extends React.Component<{
    project: ProjectName;
    push: ProjectPush;
}> {
    render() {
        return <Link to={getBaseURL(this.props.project, "ci", this.props.push.id.toString())}>
            <div>
                {this.props.push.processing ? <i className="fas fa-spinner" /> : <i className="far fa-check-circle" />} 
                <span>Push {this.props.push.id.toString()} </span>
                <span>by {this.props.push.username} </span>
                <span>on {new Date(Number.parseInt(this.props.push.time)).toISOString()}</span>
            </div>
        </Link>
    }
}

interface ProjectPushPageProps extends ProjectPageProps {
    push: number;
};

export class ProjectPushPage extends React.Component<ProjectPushPageProps, {finished: boolean}> {
    state = {
        finished: false
    };

    render() {
        return <>
            <Navbar user={this.props.user}>
                <ProjectNavbarItems project={this.props.project} />
                <CIItem path={getBaseURL(this.props.project, "ci")}>Scripts</CIItem>
                {this.state.finished ? (
                    <SuccessItem path={getBaseURL(this.props.project, "ci")}>Push {this.props.push}</SuccessItem>
                ) : (
                    <LoadingItem path={getBaseURL(this.props.project, "ci", this.props.push.toString())}>Push {this.props.push}</LoadingItem>
                )}
            </Navbar>
            <ProjectSidebar baseurl={getBaseURL(this.props.project)} active="ci" />
            <div className={page.content}>
                <div className={page.page}>
                    <ProjectPushInfo project={this.props.project} push={this.props.push} onComplete={() => this.setState({finished: true})}>{this.props.children}</ProjectPushInfo>
                </div>
            </div>
        </>;
    }
}

interface ProjectPushScript {
    name: string;
    status: "waiting" | "running" | "done";
};

interface ProjectPushBranch {
    name: string;
    status: "waiting" | "running" | "done";
    scripts: ProjectPushScript[]
}

interface ProjectPushData {
    [reference: string]: ProjectPushBranch;
};

interface ProjectPushInfoState {
    data: Response<ProjectPushData>;
    ws?: WebSocket;
    lastProps: {
        project: ProjectName
        push: number;
    };
};

class ProjectPushInfo extends React.Component<{
    project: ProjectName;
    push: number;
    onComplete: () => void;
}, ProjectPushInfoState> {
    state: ProjectPushInfoState = {
        data: {
            type: "success",
            code: 0,
            data: {}
        },
        lastProps: {
            project: this.props.project,
            push: this.props.push
        }
    };

    openConnection() {
        const ws = new WebSocket("ws://" + window.location.host + getAPIURL(this.props.project, "pushes", this.props.push.toString()));
        ws.onmessage = ev => {
            try {
                const data = JSON.parse(ev.data);
                this.setState({
                    data: data
                });
            } catch (e) {
                this.setState({
                    data: {
                        type: "bad",
                        error: e
                    }
                });
            }
        };
        ws.onclose = ev => {
            this.props.onComplete();
            this.setState({
                ws: undefined
            });
        };
        return ws;
    }

    componentDidMount() {
        this.setState({
            lastProps: this.props,
            ws: this.openConnection()
        });
    }

    componentDidUpdate() {
        //All props that determine the network data are the same, no need to update it.
        if (this.state.lastProps.push === this.props.push && this.state.lastProps.project.project === this.props.project.project && equalArrays(this.props.project.parent, this.state.lastProps.project.parent)) {
            return;
        }
        if (this.state.ws != null) {
            const s = this.state.ws.readyState;
            this.state.ws.onclose = null;
            this.state.ws.onmessage = null;
            if (s === WebSocket.OPEN || s === WebSocket.CONNECTING) {
                this.state.ws.close();
            }
        }
        this.setState({
            lastProps: this.props,
            ws: this.openConnection(),
            data: {
                type: "success",
                code: 0,
                data: {}
            }
        });
    }

    componentWillUnmount() {
        if (this.state.ws != null) {
            const s = this.state.ws.readyState;
            this.state.ws.onclose = null;
            this.state.ws.onmessage = null;
            if (s === WebSocket.OPEN || s === WebSocket.CONNECTING) {
                this.state.ws.close();
            }
        }
    }

    render() {
        if (this.state.data.type === "success") {
            const d = this.state.data.data;
            return <>
                {...Object.keys(d).map(x => <ProjectPushBranchInfo key={x} project={this.props.project} push={this.props.push} branch={d[x]} />)}
            </>;
        } else {
            return <div>
                <h2>Error:</h2>
                <p>{JSON.stringify(this.state.data)}</p>
            </div>
        }
    }
}

class ProjectPushBranchInfo extends React.Component<{
    project: ProjectName;
    push: number;
    branch: ProjectPushBranch;
}> {
    render() {
        return <div>
            <h3>{this.props.branch.status === "running" ? <i className="fas fa-spinner" /> : this.props.branch.status === "done" ? <i className="far fa-check-circle" /> : <></>}{" "}{this.props.branch.name}</h3>
            {this.props.branch.scripts.length > 0 ? <>
                <h4>Scripts</h4>
                <ol>
                    {...this.props.branch.scripts.map(script => <ProjectPushScriptInfo key={script.name} project={this.props.project} push={this.props.push} branch={this.props.branch.name} script={script} />)}
                </ol>
            </> : <></>}
        </div>
    }
}

interface ProjectPushScriptProps {
    project: ProjectName;
    push: number;
    branch: string;
    script: ProjectPushScript;
};

class ProjectPushScriptInfo extends React.Component<ProjectPushScriptProps, {
    opened: boolean;
}> {
    state = {
        opened: false
    };

    render() {
        if (this.props.script.status !== "waiting") {
            return <li>
                <a href="#" onClick={() => this.setState(state => ({opened: !state.opened}))}>
                    <div>{this.props.script.status === "running" ? <i className="fas fa-spinner" /> : this.props.script.status === "done" ? <i className="far fa-check-circle" /> : <></>}{" "}{this.props.script.name}</div>
                </a>
                {this.state.opened ? <ProjectPushScriptLogs {...this.props} /> : <></>}
            </li>;
        }
        return <li>
            <div>{this.props.script.name}</div>
        </li>;
    }
}

interface ProjectScriptLogState {
    lastProps: ProjectPushScriptProps;
    ws?: WebSocket;
}

class ProjectPushScriptLogs extends React.Component<ProjectPushScriptProps, ProjectScriptLogState> {
    state: ProjectScriptLogState;
    term: React.RefObject<XTerm> = React.createRef();

    constructor(props: ProjectPushScriptProps) {
        super(props);
        this.state = {
            lastProps: this.props
        };
    }

    openConnection() {
        const BRANCH = "refs/heads/";
        const TAG = "refs/tags/";
        let type: "branch" | "tag";
        let branchName: string;
        if (this.props.branch.startsWith(BRANCH)) {
            type = "branch";
            branchName = this.props.branch.substr(BRANCH.length);
        } else {
            type = "tag";
            branchName = this.props.branch.substr(TAG.length);
        }
        const ws = new WebSocket("ws://" + window.location.host + getAPIURL(this.props.project, "pushes", this.props.push.toString(), type, branchName, this.props.script.name));
        ws.onmessage = ev => {
            try {
                const data = JSON.parse(ev.data);
                this.term.current?.terminal.write(window.atob(data.data).split("\n").join("\r\n"));
            } catch (e) {
                console.error(e);
            }
        };
        ws.onclose = ev => {
            this.setState({
                ws: undefined
            });
        };
        this.setState({
            ws: ws
        });
        return ws;
    }

    componentDidMount() {
        this.openConnection();
    }

    componentWillUnmount() {
        if (this.state.ws != null) {
            const s = this.state.ws.readyState;
            this.state.ws.onclose = null;
            this.state.ws.onmessage = null;
            if (s === WebSocket.OPEN || s === WebSocket.CONNECTING) {
                this.state.ws.close();
            }
        }
    }

    render() {
        return <XTerm ref={this.term} />
    }
}
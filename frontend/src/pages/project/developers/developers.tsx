import { ProjectMember } from 'components/projectlist';
import React from 'react';
import { del, FailResponses, post, put, request } from 'utils/xhr';
import { getAPIURL, LoadingState, ProjectName } from '../common';
import { UserItem } from '../useritem/useritem';

interface DeveloperProps {
    project: ProjectName;
    isOwner: boolean;
    members: ProjectMember[];
    onChange: (members: ProjectMember[]) => void;
};

export class ProjectDevelopers extends React.Component<DeveloperProps, LoadingState> {
    state: LoadingState = {};
    addUser(evt: React.FormEvent<HTMLFormElement>) {
        evt.preventDefault();

        const el = evt.currentTarget.elements;

        const res = {
            username: (el.namedItem("username") as HTMLInputElement).value,
            make_branches: (el.namedItem("make_branches") as HTMLInputElement).checked,
            make_subprojects: (el.namedItem("make_subprojects") as HTMLInputElement).checked,
            make_tags: (el.namedItem("make_tags") as HTMLInputElement).checked,
            delete_tags: (el.namedItem("delete_tags") as HTMLInputElement).checked,
        };

        post(getAPIURL(this.props.project, "members"), res).then(result => {
            if (result.type === "success") {
                this.setState({
                    loading: undefined,
                });
                this.props.onChange([...this.props.members, res]);
            } else {
                this.setState({
                    loading: result,
                });
            }
        });
        this.setState({
            loading: true,
        });
        return false;
    }

    render() {
        return <div>
            <h2>Developers</h2>
            {
                (!this.props.isOwner && this.props.members.length === 0) ? <div>No other developers</div> : <div>
                    {this.props.members.map(x => <ProjectDeveloper key={x.username} project={this.props.project} member={x} isOwner={this.props.isOwner} onChange={m => {
                        this.props.onChange(this.props.members.map(x => {
                            if (x.username === m.username) {
                                return m;
                            }
                            return x;
                        }));
                    }} onDelete={m => this.props.onChange(this.props.members.filter(x => x.username !== m.username))} />)}
                    {this.props.isOwner && <form onSubmit={evt => this.addUser(evt)}>
                        <input name="username" placeholder="Username"></input>
                        {" "}Make branches: <input name="make_branches" type="checkbox"></input>
                        {" "}Make subprojects: <input name="make_subprojects" type="checkbox"></input>
                        {" "}Make tags: <input name="make_tags" type="checkbox"></input>
                        {" "}Delete tags: <input name="delete_tags" type="checkbox"></input>
                        <input type="submit" value="Add user"></input>
                    </form>}
                </div>
            }
            {this.state.loading !== true && this.state.loading != null ? JSON.stringify(this.state.loading) : ""}
        </div>;
    }
}

interface ProjectDeveloperProps {
    project: ProjectName;
    isOwner: boolean;
    member: ProjectMember;
    onChange: (dev: ProjectMember) => void;
    onDelete: (dev: ProjectMember) => void;
}

class ProjectDeveloper extends React.Component<ProjectDeveloperProps, LoadingState> {
    state: LoadingState = {};

    setUser(evt: React.ChangeEvent<HTMLInputElement>, key: "make_branches" | "make_subprojects" | "make_tags" | "delete_tags") {
        evt.preventDefault();
        const m = this.props.member;
        const res = {
            make_branches: m.make_branches,
            make_subprojects: m.make_subprojects,
            make_tags: m.make_tags,
            delete_tags: m.delete_tags,
        };
        res[key] = evt.currentTarget.checked;
        put(getAPIURL(this.props.project, "members", m.username), res).then(result => {
            if (result.type === "success") {
                this.setState({
                    loading: undefined
                });
                this.props.onChange({
                    username: m.username,
                    ...res
                });
            } else {
                this.setState({
                    loading: result
                });
            }
        });
        this.setState({
            loading: true
        });
        return false;
    }

    delUser() {
        const m = this.props.member;
        del(getAPIURL(this.props.project, "members", m.username)).then(result => {
            if (result.type === "success") {
                this.setState({
                    loading: undefined
                });
                this.props.onDelete(m);
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
        const m = this.props.member;
        const disable = this.state.loading === true || !this.props.isOwner;
        return <>
            <UserItem key={m.username} username={m.username} />
            Make branches: <input onChange={evt => this.setUser(evt, "make_branches")} checked={m.make_branches} disabled={disable} type="checkbox" />
            Make subprojects: <input onChange={evt => this.setUser(evt, "make_subprojects")} checked={m.make_subprojects} disabled={disable} type="checkbox" />
            Make tags: <input onChange={evt => this.setUser(evt, "make_tags")} checked={m.make_tags} disabled={disable} type="checkbox" />
            Delete tags: <input onChange={evt => this.setUser(evt, "delete_tags")} checked={m.delete_tags} disabled={disable} type="checkbox" />
            {this.props.isOwner ? (
                <>
                    <button onClick={() => this.delUser()} disabled={disable}>Remove</button>
                    {this.state.loading != null && this.state.loading !== true ? <>Errors occured: {JSON.stringify(this.state.loading)}</> : <></>}
                </>
             ) : <></>}
        </>;
    }
}
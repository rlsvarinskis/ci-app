import { User } from 'App';
import React from 'react';
import Modal from './modal';

interface ProjectMakerProps {
    parent: string[];
    onClose: () => void;
};

interface ProjectMakerState {
    loading: boolean;
    redirect: string | null;
    error: any;
};

export const BranchPermissions: ["NONE", "READ", "WRITE"] = ["NONE", "READ", "WRITE"];
export const BranchPermissionsText = {
    "NONE": "Hidden from others",
    "READ": "Visible to others",
    "WRITE": "Editable by others",
};

export default class ProjectMaker extends React.Component<ProjectMakerProps, ProjectMakerState> {
    state: ProjectMakerState = {
        loading: false,
        redirect: null,
        error: null,
    };

    submitForm(evt: React.FormEvent<HTMLFormElement>) {
        evt.preventDefault();

        const inp = evt.currentTarget.elements;

        const data = {
            name: (inp.namedItem("name") as HTMLInputElement).value,
            description: (inp.namedItem("description") as HTMLTextAreaElement).value,
            private: (inp.namedItem("private") as HTMLInputElement).checked,
            default_branch_permissions: (inp.namedItem("default_branch_permissions") as HTMLSelectElement).value,
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join(""));
        xhr.responseType = "json";
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => ({
                        ...state,
                        loading: false,
                        redirect: "/p/" + this.props.parent.join("/_/") + "/" + data.name,
                        error: null,
                    }));
                } else {
                    this.setState(state => ({
                        ...state,
                        loading: false,
                        redirect: null,
                        error: xhr.response,
                    }));
                }
            }
        }
        this.setState(state => ({
            ...state,
            loading: true,
            error: null,
        }));
        xhr.send(JSON.stringify(data));

        return false;
    }

    render() {
        return <Modal onClose={this.props.onClose}>
            <h1>Making a project</h1>
            <form onSubmit={evt => this.submitForm(evt)}>
                {this.props.parent.length > 0 ? <p>Parent project: <input name="parent" disabled={true} value={this.props.parent.join("/")}></input></p> : <></>}
                <p>Project name: <input name="name" disabled={this.state.loading}></input></p>
                <p>Description:</p>
                <p><textarea name="description" disabled={this.state.loading}></textarea></p>
                <p>Private project: <input type="checkbox" name="private" disabled={this.state.loading}></input></p>
                <p>By default, branches are: <select name="default_branch_permissions" disabled={this.state.loading}>{BranchPermissions.map(x => <option value={x}>{BranchPermissionsText[x]}</option>)}</select></p>
                <p><input type="submit" value="Create project" disabled={this.state.loading}></input></p>
            </form>
            <button onClick={() => this.props.onClose()}>Cancel</button>
        </Modal>
    }
}
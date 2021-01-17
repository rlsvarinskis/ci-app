import { getBaseURL } from 'pages/project/common';
import React from 'react';
import { Redirect } from 'react-router-dom';
import Modal from './modal';
import styles from '../pages/form/form.less';
import RowInput, { RowTextArea } from './rowinput';
import FormSubmit, { FormCancel } from './formsubmit';
import { FailResponses, post } from 'utils/xhr';
import selects from 'components/select/index.less';

interface ProjectMakerProps {
    parent: string[];
    onClose: () => void;
};

interface ProjectMakerState {
    name: string;
    description: string;
    private: boolean;
    default_branch_permissions: string;

    state: boolean | string | FailResponses;
};

export const BranchPermissions: ["NONE", "READ", "WRITE"] = ["NONE", "READ", "WRITE"];
export const BranchPermissionsText = {
    "NONE": "Hidden from others",
    "READ": "Visible to others",
    "WRITE": "Editable by others",
};

export default class ProjectMaker extends React.Component<ProjectMakerProps, ProjectMakerState> {
    state: ProjectMakerState = {
        name: "",
        description: "",
        private: false,
        default_branch_permissions: "READ",

        state: false
    };

    submitForm() {
        const data = {
            name: this.state.name,
            description: this.state.description,
            private: this.state.private,
            default_branch_permissions: this.state.default_branch_permissions,
        };

        post("/api/projects/" + this.props.parent.map(x => x + "/sub/").join(""), data).then(result => {
            if (result.type === "success") {
                this.setState({
                    state: getBaseURL({parent: this.props.parent, project: data.name})
                });
            } else {
                this.setState({
                    state: result
                });
            }
        });
        this.setState({
            state: true
        });
    }

    render() {
        if (typeof this.state.state === "string") {
            return <Redirect to={this.state.state}></Redirect>
        }
        return <Modal onClose={this.props.onClose}>
            <div className={styles.formpage}>
                <h2 className={styles.title}>Making a project</h2>
                <form onSubmit={evt => {evt.preventDefault(); this.submitForm(); return false;}}>
                    {this.props.parent.length > 0 ? <RowInput type="text" disabled={true} value={this.props.parent.join("/")}></RowInput> : <></>}
                    <RowInput type="text" value={this.state.name} onChange={evt => this.setState({name: evt.currentTarget.value})} disabled={this.state.state === true}>Project name</RowInput>
                    <RowTextArea style={{width: "40rem", height: "10rem"}} type="text" value={this.state.description} onChange={evt => this.setState({description: evt.currentTarget.value})} disabled={this.state.state === true}>Description</RowTextArea>
                    <label className={styles.formrow}><input type="checkbox" checked={this.state.private} onChange={evt => this.setState({private: evt.currentTarget.checked})} disabled={this.state.state === true} /> Private project</label>
                    <label className={styles.formrow}>By default, branches are: <select className={selects.select} value={this.state.default_branch_permissions} onChange={evt => this.setState({default_branch_permissions: evt.currentTarget.value})} disabled={this.state.state === true}>{BranchPermissions.map(x => <option key={x} value={x}>{BranchPermissionsText[x]}</option>)}</select></label>
                    <FormSubmit className={styles.formrow} disabled={this.state.state === true} onClick={() => this.submitForm()}>Create project</FormSubmit>
                    <FormCancel onClick={() => this.props.onClose()}>Cancel</FormCancel>
                </form>
            </div>
        </Modal>
    }
}
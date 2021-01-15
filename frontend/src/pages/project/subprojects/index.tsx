import React from 'react';
import { getAPIURL, getBaseURL, ProjectNavbarItems, ProjectPageProps } from '../common';
import Navbar from 'components/navbar';
import ProjectSidebar from 'components/sidebar';
import page from 'pages/project/page/page.less';
import { BranchesItem, FolderItem } from 'components/navbar/item';
import ProjectList from 'components/projectlist';

export default class ProjectSubprojectsPage extends React.Component<ProjectPageProps> {
    render() {
        return <>
            <Navbar user={this.props.user}><ProjectNavbarItems project={this.props.project} /><FolderItem path={getBaseURL(this.props.project) + "/branches"}>Subprojects</FolderItem></Navbar>
            <ProjectSidebar baseurl={getBaseURL(this.props.project)} active="sub"></ProjectSidebar>
            <div className={page.content + " " + page.mini}>
                <div className={page.page}>
                    <h1>Subprojects</h1>
                    <ProjectList user={this.props.user} parent={[...this.props.project.parent, this.props.project.project]} />
                </div>
            </div>
        </>
    }
};
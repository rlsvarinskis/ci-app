import React from 'react';
import { Link } from 'react-router-dom';
import navbar from 'pages/project/navbar.less';

type LinkType = "main" | "src" | "branches" | "ci" | "sub";

interface ProjectSidebarProps {
    baseurl: string;
    active: LinkType;
};

interface LinkProps {
    to: string;
    targetActive: LinkType;
    active: LinkType;
};

class LinkCategory extends React.Component<LinkProps> {
    render() {
        return <Link to={this.props.to} {...(this.props.active === this.props.targetActive ? {"data-selected": true} : {})}>{this.props.children}</Link>
    }
}

export default class ProjectSidebar extends React.Component<ProjectSidebarProps> {
    render() {
        return <div className={navbar.navbar}>
            <LinkCategory to={this.props.baseurl + "/"} targetActive="main" active={this.props.active}><i className="fas fa-project-diagram"></i>Project</LinkCategory>
            <LinkCategory to={this.props.baseurl + "/src"} targetActive="src" active={this.props.active}><i className="fas fa-code"></i>Source code</LinkCategory>
            {/*<LinkCategory to={this.props.baseurl + "/"} targetActive="main" active={this.props.active}><i className="fas fa-bars"></i>Activity</LinkCategory>*/} 
            <LinkCategory to={this.props.baseurl + "/branches"} targetActive="branches" active={this.props.active}><i className="fas fa-code-branch"></i>Branches</LinkCategory>
            <LinkCategory to={this.props.baseurl + "/ci"} targetActive="ci" active={this.props.active}><i className="fas fa-cogs"></i>Scripts</LinkCategory>
            <LinkCategory to={this.props.baseurl + "/sub"} targetActive="sub" active={this.props.active}><i className="fas fa-folder"></i>Subprojects</LinkCategory>
        </div>;
    }
}
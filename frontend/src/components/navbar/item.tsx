import React from 'react';
import { Link } from 'react-router-dom';

interface CustomNavbarProps {
    path: string;
}

interface NavbarItemProps extends CustomNavbarProps {
    icon?: string;
};

export class NavbarItem extends React.Component<NavbarItemProps> {
    render() {
        return <Link to={this.props.path}>{this.props.icon != null ? <i className={this.props.icon} /> : <></>}{this.props.children}</Link>;
    }
}

export class ProjectItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-project-diagram" />{this.props.children}</Link>
    }
}

export class SourceCodeItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-code" />{this.props.children}</Link>
    }
}

export class BranchesItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-code-branch" />{this.props.children}</Link>
    }
}

export class FolderItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-folder" />{this.props.children}</Link>
    }
}

export class SuccessItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="far fa-check-circle" />{this.props.children}</Link>
    }
}

export class LoadingItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-spinner" />{this.props.children}</Link>
    }
}

export class ErrorItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-times-circle" />{this.props.children}</Link>
    }
}

export class LoginItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-sign-in-alt" />{this.props.children}</Link>
    }
}

export class ProfileItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-user-circle" />{this.props.children}</Link>
    }
}

export class RegisterItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-poll-h" />{this.props.children}</Link>
    }
}

export class DevelopersItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-users" />{this.props.children}</Link>
    }
}

export class CIItem extends React.Component<CustomNavbarProps> {
    render() {
        return <Link to={this.props.path}><i className="fas fa-cogs" />{this.props.children}</Link>
    }
}
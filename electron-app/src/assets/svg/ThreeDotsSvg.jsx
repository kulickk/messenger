import SvgComponent from "../SvgComponent.jsx";

const ThreeDotsSvg = ({className=""}) => {
    return(
        <SvgComponent className={ className }>
            <svg width="4" height="20" viewBox="0 0 4 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0H4V4H0V0Z" fill="#2C2C2C"/>
                <path d="M0 8H4V12H0V8Z" fill="#2C2C2C"/>
                <path d="M0 16H4V20H0V16Z" fill="#2C2C2C"/>
            </svg>
        </SvgComponent>
    );
};

export default ThreeDotsSvg;
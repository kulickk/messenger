import SvgComponent from "../SvgComponent.jsx";

const ThreeLinesSvg = ({className=""}) => {
    return(
        <SvgComponent className={ className }>
            <svg width="30" height="20" viewBox="0 0 30 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="30" height="4" fill="#2C2C2C"/>
                <rect y="8" width="30" height="4" fill="#2C2C2C"/>
                <rect y="16" width="30" height="4" fill="#2C2C2C"/>
            </svg>
        </SvgComponent>
    );
};

export default ThreeLinesSvg;
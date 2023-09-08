//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ETHWrapper.sol";
import "./interfaces/IERC20Token.sol";

// import "./interfaces/IBridge.sol";

contract Bridge {
    uint256 immutable chaindId;
    address public admin;
    IERC20Token public token;
    mapping(address => mapping(uint => bool)) public processedNonces;

    // the source and target addresses will be swapped and the chaindId(uint256) will be different
    // mapping(uint256 => mapping(address => address)) sourceTokenToTargetToken;
    mapping(address => address) sourceTokenToTargetToken;
    // mapping(uint256 => mapping(address => address)) targetTokenToSourceToken;
    // ETHWrapper public ethWrapper;
    uint256 serviceFee = 0.01 ether;

    // enum Step {
    //     Burn,
    //     Mint
    // }
    // event Transfer(
    //     Step indexed step,
    //     address from,
    //     address to,
    //     uint amount,
    //     uint date,
    //     uint nonce,
    //     bytes signature
    // );
    event BurnToken(
        address from,
        address to,
        uint amount,
        uint date,
        uint nonce,
        bytes signature
    );

    event LockToken(
        address from,
        uint256 targetChainId,
        address token,
        uint amount,
        bytes signature
    );

    event ClaimToken(
        address from,
        address to,
        uint amount,
        uint date,
        uint nonce,
        bytes signature
    );

    constructor(address _token) {
        admin = msg.sender;
        token = IERC20Token(_token);
        chaindId = block.chainid;
    }

    // Add a new token that is unknown up to this point
    function registerToken(
        string memory _name,
        string memory _symbol
    ) external /* override onlyOwner returns (ERC20Token wrappedToken) */ {
        // if (sourceTokenToTargetToken)
        // ERC20Token ercToken = new ERC20Token(_name, _symbol, msg.sender);
        // wrappedTokenContracts[address(ercToken)] = ercToken;
        // createdWrappedTokens.push(address(ercToken));
        // emit ETHTokenCreated(address(ercToken), _name, _symbol);
        // return ercToken;
    }

    function lockToken(
        uint256 _targetChainId,
        address _token,
        uint256 _amount,
        bytes calldata _signature
    ) external payable {
        require(_amount > 0, "Bridged amount is required.");
        require(msg.value >= serviceFee, "Not enough service fee");
        require(
            sourceTokenToTargetToken[_token] != address(0),
            "Register the token before bridging it"
        );
        // ERC20(_token).permit(); // Add permit functionality
        ERC20(_token).transferFrom(msg.sender, address(this), _amount);
        emit LockToken(msg.sender, _targetChainId, _token, _amount, _signature);
    }

    function release(uint256 _amount, address payable _token) external {
        // ERC20Token(_token).transfer(msg.sender, _amount);
        // emit ReleaseToken(msg.sender, _token, _amount);
    }

    function burn(
        address to,
        uint amount,
        uint nonce,
        bytes calldata signature
    ) external {
        // Burn can be called only for the wrapped tokens on Mumbai
        if (chaindId != 80001) revert();
        require(
            processedNonces[msg.sender][nonce] == false,
            "transfer already processed"
        );
        processedNonces[msg.sender][nonce] = true;
        token.burn(msg.sender, amount);
        // emit Transfer(
        //     Step.Burn,
        //     msg.sender,
        //     to,
        //     amount,
        //     block.timestamp,
        //     nonce,
        //     signature
        // );
        emit BurnToken(
            msg.sender,
            to,
            amount,
            block.timestamp,
            nonce,
            signature
        );
    }

    function mint(
        address from,
        address to,
        uint amount,
        uint nonce,
        bytes calldata signature
    ) external {
        if (chaindId != 80001) revert();

        bytes32 message = prefixed(
            keccak256(abi.encodePacked(from, to, amount, nonce))
        );
        require(recoverSigner(message, signature) == from, "wrong signature");
        require(
            processedNonces[from][nonce] == false,
            "transfer already processed"
        );
        processedNonces[from][nonce] = true;
        token.mint(to, amount);
        // emit Transfer(
        //     Step.Mint,
        //     from,
        //     to,
        //     amount,
        //     block.timestamp,
        //     nonce,
        //     signature
        // );
        emit ClaimToken(from, to, amount, block.timestamp, nonce, signature);
    }

    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    function recoverSigner(
        bytes32 message,
        bytes calldata sig
    ) internal pure returns (address) {
        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = splitSignature(sig);
        return ecrecover(message, v, r, s);
    }

    function splitSignature(
        bytes memory sig
    ) internal pure returns (uint8, bytes32, bytes32) {
        require(sig.length == 65);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }
        return (v, r, s);
    }
}

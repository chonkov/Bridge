//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20, IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Token, IERC20Token} from "./ERC20Token.sol";
import {IBridge} from "./interfaces/IBridge.sol";

contract Bridge is IBridge, Ownable {
    uint256 public constant SERVICE_FEE = 0.01 ether;
    uint256 public immutable SOURCE_CHAIN_ID;

    mapping(address => mapping(uint => bool)) public processedNonces;
    mapping(address => ERC20Token) public wrappedTokenContracts;
    address[] public createdWrappedTokens;

    event DeployToken(
        address indexed deployer,
        address indexed source,
        address indexed wrapper,
        string name,
        string symbol
    );

    event BurnToken(
        address token,
        address from,
        uint256 chainId,
        uint amount,
        uint nonce
    );

    event LockToken(
        address token,
        address from,
        uint256 chainId,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes signature
    );

    event ClaimToken(
        address token,
        address from,
        address to,
        uint chainId,
        uint amount,
        uint nonce,
        bytes signature
    );

    event ReleaseToken(address token, address to, uint amount);

    constructor() {
        uint id;
        assembly {
            id := chainid()
        }
        SOURCE_CHAIN_ID = id;
    }

    function lockToken(
        address _token,
        uint256 _amount,
        uint256 _deadline,
        bytes calldata _signature
    ) external payable {
        require(_amount > 0, "Bridged amount is required");
        require(msg.value >= SERVICE_FEE, "Not enough service fee");

        // try ERC20Token(_token).owner() returns (address _owner) {
        //     if (_owner == address(this)) {
        //         uint _nonce = ERC20Token(_token).nonces(msg.sender);
        //         _burn(_token, _amount, _nonce); // internal call

        //         emit LockToken(
        //             _token,
        //             msg.sender,
        //             block.chainid,
        //             _amount,
        //             _deadline,
        //             _signature
        //         );
        //         return;
        //     }
        // } catch {}

        uint nonce = IERC20Permit(_token).nonces(msg.sender);
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(_signature);
        IERC20Permit(_token).permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            v,
            r,
            s
        );
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        emit LockToken(
            _token,
            msg.sender,
            block.chainid,
            _amount,
            nonce,
            _deadline,
            _signature
        );
    }

    function release(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        IERC20(_token).transfer(_to, _amount);
        emit ReleaseToken(_token, _to, _amount);
    }

    function burn(address _token, uint256 _amount, uint _nonce) external {
        // Burn can be called only for the wrapped tokens on Mumbai
        // require(
        //     block.chainid == TARGET_CHAIN_ID,
        //     "Can only burn wrapped tokens on target chain"
        // );
        require(
            processedNonces[msg.sender][_nonce] == false,
            "transfer already processed"
        );
        _burn(_token, _amount, _nonce);
    }

    function _burn(address _token, uint256 _amount, uint _nonce) internal {
        processedNonces[msg.sender][_nonce] = true;

        IERC20Token(_token).burn(msg.sender, _amount);
        emit BurnToken(_token, msg.sender, block.chainid, _amount, _nonce);
    }

    function claim(
        address _token,
        string calldata _name,
        string calldata _symbol,
        address _from,
        address _to,
        uint _amount,
        uint _nonce,
        bytes calldata _signature
    ) external {
        // require(
        //     block.chainid == TARGET_CHAIN_ID,
        //     "Can only claim wrapped tokens on target chain"
        // );
        ERC20Token wrapper;
        if (wrappedTokenContracts[_token] == ERC20Token(address(0))) {
            wrapper = new ERC20Token(_name, _symbol, address(this));
            wrappedTokenContracts[_token] = wrapper;
            createdWrappedTokens.push(address(wrapper));

            emit DeployToken(
                msg.sender,
                _token,
                address(wrapper),
                _name,
                _symbol
            );
        } else {
            wrapper = wrappedTokenContracts[_token];
        }

        require(
            processedNonces[_from][_nonce] == false,
            "transfer already processed"
        );

        bytes32 message = prefixed(
            keccak256(abi.encodePacked(_from, _to, _amount, _nonce))
        );
        require(recoverSigner(message, _signature) == _from, "wrong signature"); // from == msg.sender

        processedNonces[_from][_nonce] = true;
        wrapper.mint(_to, _amount);
        emit ClaimToken(
            _token,
            _from,
            _to,
            block.chainid,
            _amount,
            _nonce,
            _signature
        );
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
        require(sig.length == 65, "invalid signature length");
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

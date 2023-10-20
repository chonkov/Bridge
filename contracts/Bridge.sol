//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20, IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Token, IERC20Token} from "./ERC20Token.sol";
import {ERC20PermitToken} from "./ERC20PermitToken.sol";
import {IBridge} from "./interfaces/IBridge.sol";

contract Bridge is IBridge, Ownable {
    uint256 public constant SERVICE_FEE = 0.01 ether;

    mapping(address addr => mapping(uint256 nonce => bool isProcessed))
        public processedNonces;
    mapping(address source => ERC20Token dest) public wrappedTokenContracts;
    address[] public createdWrappedTokens;

    event DeployToken(
        address indexed deployer,
        address indexed source,
        address indexed wrapper,
        string name,
        string symbol
    );

    event BurnToken(
        address indexed token,
        address indexed from,
        uint256 blockNumber,
        uint256 chainId,
        uint256 amount,
        uint256 nonce
    );

    event LockToken(
        address indexed token,
        address indexed from,
        uint256 blockNumber,
        uint256 chainId,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes signature
    );

    event ClaimToken(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 blockNumber,
        uint256 chainId,
        uint256 amount,
        uint256 nonce,
        bytes signature
    );

    event ReleaseToken(
        address indexed token,
        address indexed operator,
        address indexed to,
        uint256 blockNumber,
        uint256 chainId,
        uint256 amount
    );

    function lock(
        address _token,
        uint256 _amount,
        uint256 _deadline,
        bytes calldata _signature
    ) external payable {
        require(_amount > 0, "Bridged amount is required");
        require(msg.value >= SERVICE_FEE, "Not enough service fee");

        address from = _msgSender();
        address to = address(this);

        uint256 nonce = IERC20Permit(_token).nonces(from);
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(_signature);
        IERC20Permit(_token).permit(from, to, _amount, _deadline, v, r, s);
        IERC20(_token).transferFrom(from, to, _amount);
        emit LockToken(
            _token,
            from,
            block.number,
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
        uint256 _amount,
        uint256 _nonce,
        bytes calldata _signature
    ) external {
        address from = _msgSender();

        bytes32 message = prefixed(
            keccak256(abi.encodePacked(from, _to, _amount, _nonce))
        );

        require(recoverSigner(message, _signature) == from, "wrong signature");

        IERC20(_token).transfer(_to, _amount);
        emit ReleaseToken(
            _token,
            from,
            _to,
            block.number,
            block.chainid,
            _amount
        );
    }

    function burn(address _token, uint256 _amount, uint256 _nonce) external {
        require(
            processedNonces[_msgSender()][_nonce] == false,
            "transfer already processed"
        );
        _burn(_token, _amount, _nonce);
    }

    function _burn(address _token, uint256 _amount, uint256 _nonce) internal {
        processedNonces[_msgSender()][_nonce] = true;

        IERC20Token(_token).burn(_msgSender(), _amount);
        emit BurnToken(
            _token,
            _msgSender(),
            block.number,
            block.chainid,
            _amount,
            _nonce
        );
    }

    function claim(
        address _token,
        string calldata _name,
        string calldata _symbol,
        address _from,
        address _to,
        uint256 _amount,
        uint256 _nonce,
        bytes calldata _signature
    ) external {
        ERC20Token wrapper;
        if (wrappedTokenContracts[_token] == ERC20Token(address(0))) {
            wrapper = new ERC20Token(_name, _symbol, address(this));
            wrappedTokenContracts[_token] = wrapper;
            createdWrappedTokens.push(address(wrapper));

            emit DeployToken(
                _msgSender(),
                _token,
                address(wrapper),
                _name,
                _symbol
            );
        } else {
            wrapper = wrappedTokenContracts[_token];

            assert(
                keccak256(abi.encode(wrapper.name())) ==
                    keccak256(abi.encode(_name))
            );
            assert(
                keccak256(abi.encode(wrapper.symbol())) ==
                    keccak256(abi.encode(_symbol))
            );
        }

        require(
            processedNonces[_from][_nonce] == false,
            "transfer already processed"
        );

        bytes32 message = prefixed(
            keccak256(abi.encodePacked(_from, _to, _amount, _nonce))
        );
        require(recoverSigner(message, _signature) == _from, "wrong signature"); // from == _msgSender()

        processedNonces[_from][_nonce] = true;
        wrapper.mint(_to, _amount);
        emit ClaimToken(
            _token,
            _from,
            _to,
            block.number,
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

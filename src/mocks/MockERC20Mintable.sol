// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title MockERC20Mintable
 * @notice Minimal ERC20 with controlled mint/burn for testing
 */
contract MockERC20Mintable {
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint256 public totalSupply;
    address public minter;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event MinterUpdated(address indexed newMinter);

    modifier onlyMinter() {
        require(msg.sender == minter, "Not minter");
        _;
    }

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        minter = msg.sender;
    }

    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    function setMinter(address newMinter) external onlyMinter {
        minter = newMinter;
        emit MinterUpdated(newMinter);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "insufficient allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 value) external onlyMinter {
        totalSupply += value;
        _balances[to] += value;
        emit Transfer(address(0), to, value);
    }

    function burn(address from, uint256 value) external onlyMinter {
        require(_balances[from] >= value, "insufficient balance");
        _balances[from] -= value;
        totalSupply -= value;
        emit Transfer(from, address(0), value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(_balances[from] >= value, "insufficient balance");
        _balances[from] -= value;
        _balances[to] += value;
        emit Transfer(from, to, value);
    }
}
